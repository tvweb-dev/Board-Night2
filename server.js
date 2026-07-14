const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 5173;
const ROOT = __dirname;
const API_BASE_URL = process.env.BOARD_NIGHT_API_URL || "https://board-night-server-594j5.ondigitalocean.app";
const SITE_URL = (process.env.BOARD_NIGHT_SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const DEFAULT_SSR_USER_ID = Number(process.env.BOARD_NIGHT_SSR_USER_ID || 1);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function prettyDate(value) {
  if (!value) return "Date TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date TBD";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

async function api(pathname, options) {
  const response = await fetch(`${API_BASE_URL}${pathname}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options && options.headers ? options.headers : {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({ success: false, message: "Invalid API response" }));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `API request failed for ${pathname}`);
  }

  return payload.data;
}

async function getGroups(userId) {
  const rows = await api(`/api/groups/user/${userId}`);
  return rows.map((row) => ({
    id: row.GROUP_ID,
    name: row.GROUP_NAME,
    hostId: row.CREATED_BY
  }));
}

async function getEvents(groupId) {
  const rows = await api(`/api/events/group/${groupId}`);
  return rows.map((row) => ({
    id: row.EVENT_ID,
    groupId: row.GROUP_ID,
    hostId: row.HOST_ID,
    title: row.EVENT_TITLE,
    date: row.EVENT_DATE ? String(row.EVENT_DATE).slice(0, 10) : "",
    time: row.EVENT_TIME || "",
    location: row.EVENT_LOCATION || "",
    cancelled: row.EVENT_STATUS === "CANCELLED"
  }));
}

async function getRsvps(eventId) {
  const rows = await api(`/api/events/${eventId}/rsvps`);
  return rows.map((row) => ({
    userId: row.USER_ID,
    userName: row.EMAIL || `User ${row.USER_ID}`,
    status: row.RSVP_STATUS
  }));
}

async function getMembers(groupId) {
  const rows = await api(`/api/groups/${groupId}/members`);
  return rows.map((row) => ({
    id: row.USER_ID,
    name: row.EMAIL || `User ${row.USER_ID}`,
    role: row.MEMBER_ROLE
  }));
}

async function getEventFromUserGroups(eventId, userId) {
  const groups = await getGroups(userId);
  for (const group of groups) {
    const events = await getEvents(group.id);
    const match = events.find((event) => String(event.id) === String(eventId));
    if (match) {
      return { event: match, group };
    }
  }
  return null;
}

function seoTags(meta) {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const canonical = escapeHtml(meta.canonical);
  const image = escapeHtml(meta.image || `${SITE_URL}/docs/board-night-social.png`);
  const type = escapeHtml(meta.ogType || "website");
  const robots = escapeHtml(meta.robots || "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");
  const structuredData = JSON.stringify(meta.structuredData || {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Board Night",
    url: SITE_URL,
    description: meta.description
  }).replace(/</g, "\\u003c");

  return [
    `<meta name="description" content="${description}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<script type="application/ld+json">${structuredData}</script>`
  ].join("\n  ");
}

function applySeo(html, meta) {
  const head = seoTags(meta);
  let out = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
  out = out.replace("</head>", `  ${head}\n</head>`);
  return out;
}

function withSsrBlock(html, marker, block) {
  if (!block) return html;
  return html.replace(marker, `${marker}\n${block}`);
}

async function renderIndex(reqUrl, html) {
  const canonical = `${SITE_URL}${reqUrl.pathname === "/" ? "/" : reqUrl.pathname}`;
  const meta = {
    title: "Board Night | Plan Better Game Nights",
    description: "Board Night helps groups schedule game nights, coordinate RSVPs, and keep event details in one place.",
    canonical,
    ogType: "website",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Board Night",
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web",
      url: canonical,
      description: "Plan game nights with invitations, RSVPs, and event details."
    }
  };

  const ssr = `
  <section class="card" aria-label="Board Night Overview">
    <h2>Organize Your Next Board Game Night</h2>
    <p>Board Night gives hosts and players one place to create groups, schedule events, and track who is going.</p>
    <ul>
      <li>Create recurring game groups with your friends</li>
      <li>Publish event date, time, and location details</li>
      <li>Collect and update RSVPs in real time</li>
    </ul>
  </section>`;

  return applySeo(withSsrBlock(html, '<div class="container" style="max-width:420px;margin-top:8vh;">', ssr), meta);
}

async function renderDashboard(reqUrl, html) {
  const userId = Number(reqUrl.searchParams.get("user")) || DEFAULT_SSR_USER_ID;
  const canonical = `${SITE_URL}/dashboard`;
  let description = "Manage your Board Night groups and create upcoming events.";
  let ssrCards = '<p class="empty">Sign in to load your groups.</p>';

  try {
    const groups = await getGroups(userId);
    if (groups.length) {
      description = `View ${groups.length} Board Night groups, including members and upcoming events.`;
      const cards = await Promise.all(groups.slice(0, 8).map(async (group) => {
        const [members, events] = await Promise.all([getMembers(group.id), getEvents(group.id)]);
        return `<article class="card"><h3>${escapeHtml(group.name)}</h3><p class="subtle">${members.length} member(s) · ${events.length} event(s)</p></article>`;
      }));
      ssrCards = cards.join("\n");
    }
  } catch (error) {
    ssrCards = `<p class="empty">Unable to pre-render groups right now.</p>`;
  }

  const meta = {
    title: "Board Night Dashboard | Groups And Events",
    description,
    canonical,
    ogType: "website"
  };

  const withCards = html.replace('<div id="groupList" class="grid"></div>', `<div id="groupList" class="grid">${ssrCards}</div>`);
  return applySeo(withCards, meta);
}

async function renderGroup(reqUrl, html) {
  const groupId = reqUrl.searchParams.get("group");
  const userId = Number(reqUrl.searchParams.get("user")) || DEFAULT_SSR_USER_ID;
  const canonical = `${SITE_URL}/group${groupId ? `?group=${encodeURIComponent(groupId)}` : ""}`;

  let title = "Board Night Group | Members And Events";
  let description = "View a Board Night group, its members, and upcoming events.";
  let membersHtml = '<li class="empty">Select a group to view members.</li>';
  let eventsHtml = '<p class="empty">Select a group to view events.</p>';
  let groupNameHeading = "Group";

  if (groupId) {
    try {
      const groups = await getGroups(userId);
      const group = groups.find((g) => String(g.id) === String(groupId));
      if (group) {
        groupNameHeading = group.name;
        title = `${group.name} | Board Night Group`;
        const [members, events] = await Promise.all([getMembers(group.id), getEvents(group.id)]);
        description = `${group.name} has ${members.length} members and ${events.length} events on Board Night.`;
        membersHtml = members.length
          ? members.map((member) => `<li>${escapeHtml(member.name)}</li>`).join("")
          : '<li class="empty">No members yet.</li>';
        eventsHtml = events.length
          ? events.map((event) => `<article class="card"><h3>${escapeHtml(event.title)}</h3><p class="subtle">${escapeHtml(prettyDate(event.date))} · ${escapeHtml(event.time || "TBD")} · ${escapeHtml(event.location || "Location TBD")}</p></article>`).join("")
          : '<p class="empty">No events yet.</p>';
      }
    } catch (error) {
      membersHtml = '<li class="empty">Unable to pre-render members.</li>';
      eventsHtml = '<p class="empty">Unable to pre-render events.</p>';
    }
  }

  const meta = { title, description, canonical, ogType: "website" };
  let out = html.replace('<h1 id="groupName">Group</h1>', `<h1 id="groupName">${escapeHtml(groupNameHeading)}</h1>`);
  out = out.replace('<ul class="plain" id="memberList"></ul>', `<ul class="plain" id="memberList">${membersHtml}</ul>`);
  out = out.replace('<div id="eventList"></div>', `<div id="eventList">${eventsHtml}</div>`);
  return applySeo(out, meta);
}

async function renderEvent(reqUrl, html) {
  const eventId = reqUrl.searchParams.get("event");
  const userId = Number(reqUrl.searchParams.get("user")) || DEFAULT_SSR_USER_ID;
  const canonical = `${SITE_URL}/event${eventId ? `?event=${encodeURIComponent(eventId)}` : ""}`;

  let title = "Board Night Event | RSVP And Details";
  let description = "See Board Night event details and RSVP status.";
  let eventTitle = "Event";
  let eventMeta = "Select an event to view details.";
  let eventDesc = "";
  let goingCount = 0;

  if (eventId) {
    try {
      const found = await getEventFromUserGroups(eventId, userId);
      if (found) {
        const { event } = found;
        const rsvps = await getRsvps(event.id);
        goingCount = rsvps.filter((r) => r.status === "GOING").length;
        eventTitle = event.title;
        eventMeta = `${prettyDate(event.date)} · ${event.time || "Time TBD"} · ${event.location || "Location TBD"}`;
        eventDesc = event.cancelled ? "This event has been cancelled." : "RSVP to let the host know if you can make it.";
        title = `${event.title} | Board Night Event`;
        description = `${event.title} is on ${prettyDate(event.date)} at ${event.location || "TBD"}. ${goingCount} attendee(s) are currently going.`;
      }
    } catch (error) {
      eventDesc = "Unable to pre-render event details right now.";
    }
  }

  const meta = {
    title,
    description,
    canonical,
    ogType: "event",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Event",
      name: eventTitle,
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      startDate: eventMeta,
      description,
      location: {
        "@type": "Place",
        name: eventMeta
      },
      organizer: {
        "@type": "Organization",
        name: "Board Night"
      },
      url: canonical
    }
  };

  let out = html.replace('<h1 id="eventTitle">Event</h1>', `<h1 id="eventTitle">${escapeHtml(eventTitle)}</h1>`);
  out = out.replace('<p class="subtle" id="eventMeta"></p>', `<p class="subtle" id="eventMeta">${escapeHtml(eventMeta)}</p>`);
  out = out.replace('<p id="eventDesc"></p>', `<p id="eventDesc">${escapeHtml(eventDesc)}</p>`);
  out = out.replace('<span class="count-badge" id="goingCount">0</span>', `<span class="count-badge" id="goingCount">${goingCount}</span>`);
  return applySeo(out, meta);
}

async function renderRsvp(reqUrl, html) {
  const eventId = reqUrl.searchParams.get("event");
  const userId = Number(reqUrl.searchParams.get("user")) || DEFAULT_SSR_USER_ID;
  const canonical = `${SITE_URL}/rsvp${eventId ? `?event=${encodeURIComponent(eventId)}` : ""}`;

  let title = "Board Night RSVP | Confirm Attendance";
  let description = "Confirm whether you can attend this Board Night event.";
  let card = '<p class="empty">Open an invite link to RSVP for an event.</p>';

  if (eventId) {
    try {
      const found = await getEventFromUserGroups(eventId, userId);
      if (found) {
        const { event } = found;
        title = `${event.title} RSVP | Board Night`;
        description = `RSVP for ${event.title} on ${prettyDate(event.date)} at ${event.location || "TBD"}.`;
        card = `<h3>${escapeHtml(event.title)}</h3><p class="subtle">${escapeHtml(prettyDate(event.date))} · ${escapeHtml(event.time || "Time TBD")} · ${escapeHtml(event.location || "Location TBD")}</p><p>Use the form below to confirm your RSVP.</p>`;
      }
    } catch (error) {
      card = '<p class="empty">Unable to pre-render this invite right now.</p>';
    }
  }

  const meta = { title, description, canonical, ogType: "website", robots: "noindex,follow" };
  const out = html.replace('<div class="card" id="card">\n      <p class="empty">Loading invite...</p>\n    </div>', `<div class="card" id="card">${card}</div>`);
  return applySeo(out, meta);
}

const RENDERERS = {
  "/": { file: "index.html", render: renderIndex },
  "/index.html": { file: "index.html", render: renderIndex },
  "/dashboard": { file: "dashboard.html", render: renderDashboard },
  "/dashboard.html": { file: "dashboard.html", render: renderDashboard },
  "/group": { file: "group.html", render: renderGroup },
  "/group.html": { file: "group.html", render: renderGroup },
  "/event": { file: "event.html", render: renderEvent },
  "/event.html": { file: "event.html", render: renderEvent },
  "/rsvp": { file: "rsvp.html", render: renderRsvp },
  "/rsvp.html": { file: "rsvp.html", render: renderRsvp },
  "/event-edit": {
    file: "event-edit.html",
    render: async (reqUrl, html) => applySeo(html, {
      title: "Create Or Edit Event | Board Night",
      description: "Create or edit a Board Night event with time, date, and location details.",
      canonical: `${SITE_URL}/event-edit`,
      robots: "noindex,follow"
    })
  },
  "/event-edit.html": {
    file: "event-edit.html",
    render: async (reqUrl, html) => applySeo(html, {
      title: "Create Or Edit Event | Board Night",
      description: "Create or edit a Board Night event with time, date, and location details.",
      canonical: `${SITE_URL}/event-edit`,
      robots: "noindex,follow"
    })
  }
};

function safeFilePath(requestPathname) {
  const decoded = decodeURIComponent(requestPathname);
  const normalized = path.normalize(decoded).replace(/^([.]{2}[\\/])+/, "");
  const filePath = path.join(ROOT, normalized);
  if (!filePath.startsWith(ROOT)) return null;
  return filePath;
}

function send(res, statusCode, contentType, body) {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const route = RENDERERS[reqUrl.pathname];

    if (route) {
      const templatePath = path.join(ROOT, route.file);
      const source = await fs.promises.readFile(templatePath, "utf8");
      const rendered = await route.render(reqUrl, source);
      send(res, 200, "text/html; charset=utf-8", rendered);
      return;
    }

    const filePath = safeFilePath(reqUrl.pathname);
    if (!filePath) {
      send(res, 400, "text/plain; charset=utf-8", "Invalid path");
      return;
    }

    const stat = await fs.promises.stat(filePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      send(res, 404, "text/plain; charset=utf-8", "Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const data = await fs.promises.readFile(filePath);
    send(res, 200, contentType, data);
  } catch (error) {
    console.error("SSR server error:", error);
    send(res, 500, "text/plain; charset=utf-8", "Internal Server Error");
  }
});

server.listen(PORT, () => {
  console.log(`Board Night SSR server running at ${SITE_URL}`);
  console.log(`Using API: ${API_BASE_URL}`);
});
