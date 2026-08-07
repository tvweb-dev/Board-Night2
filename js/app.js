/* Board Night — shared helpers used across pages */

// Read a query-string value, e.g. ?group=g1  ->  qs("group")
function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// Escape text before putting it into the page (basic safety)
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// Friendly date label, e.g. "Thu, Jul 9, 2026"
function prettyDate(dateStr) {
  if (!dateStr) return "(no date)";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

// Map an RSVP status to a label + pill class
const STATUS_LABEL = { going: "Going", maybe: "Maybe", no: "Can't make it" };
const STATUS_CLASS = { going: "going", maybe: "maybe", no: "no" };
const NOTIFICATION_SEEN_KEY = "boardNightSeenNotifications";

function startNotificationToasts() {
  let dismissTimer = null;
  const storageKey = `${NOTIFICATION_SEEN_KEY}:${DB.currentUserId()}`;

  function seenIds() {
    try { return new Set(JSON.parse(sessionStorage.getItem(storageKey) || "[]").map(String)); }
    catch (_) { return new Set(); }
  }

  function remember(id) {
    const seen = seenIds();
    seen.add(String(id));
    sessionStorage.setItem(storageKey, JSON.stringify(Array.from(seen).slice(-100)));
  }

  function dismiss(toast) {
    if (dismissTimer) window.clearTimeout(dismissTimer);
    toast.classList.add("is-leaving");
    window.setTimeout(function () { toast.remove(); }, 180);
  }

  function show(item) {
    const existing = document.getElementById("notificationToast");
    if (existing) existing.remove();
    const toast = document.createElement("aside");
    toast.className = "notification-toast";
    toast.id = "notificationToast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.innerHTML = `
      <span class="toast-indicator" aria-hidden="true"></span>
      <a class="toast-copy" href="notifications.html">
        <strong>${esc(item.TITLE || "New notification")}</strong>
        <span>${esc(item.MESSAGE || "You have a new Board Night update.")}</span>
      </a>
      <button class="toast-close" type="button" aria-label="Close notification">&times;</button>`;
    document.body.appendChild(toast);
    toast.querySelector(".toast-close").addEventListener("click", function () { dismiss(toast); });
    dismissTimer = window.setTimeout(function () { dismiss(toast); }, 10000);
  }

  async function check() {
    try {
      const items = await DB.getNotifications(true);
      const count = document.getElementById("notificationCount");
      if (count) {
        count.textContent = items.length > 99 ? "99+" : String(items.length);
        count.hidden = items.length === 0;
      }
      const seen = seenIds();
      const newest = items.find(function (item) { return !seen.has(String(item.NOTIFICATION_ID)); });
      if (!newest) return;
      items.forEach(function (item) { remember(item.NOTIFICATION_ID); });
      show(newest);
    } catch (_) {}
  }

  check();
  window.setInterval(check, 30000);
}

// Shared desktop application shell, based on the desktop standalone design.
function renderTopbar() {
  const el = document.getElementById("topbar");
  if (!el) return;
  const user = DB.currentUser();
  const path = window.location.pathname.split("/").pop() || "dashboard.html";
  const groupsActive = ["dashboard.html", "group.html"].includes(path);
  const eventsActive = ["events.html", "event.html", "event-edit.html"].includes(path);
  const calendarActive = path === "calendar.html";
  const friendsActive = path === "friends.html";
  const notificationsActive = path === "notifications.html";
  const mobileTitles = {
    "dashboard.html": "Your Groups",
    "events.html": "Events",
    "calendar.html": "Calendar",
    "friends.html": "Friends",
    "notifications.html": "Notifications",
    "group.html": "Group",
    "event.html": "Event",
    "event-edit.html": qs("event") ? "Edit Event" : "Create Event"
  };
  const mobileBack = path === "dashboard.html" ? "" :
    `<button class="mobile-back" type="button" aria-label="Go back">‹</button>`;
  const initials = user && user.name
    ? user.name.split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) { return part[0]; }).join("").toUpperCase()
    : "BN";

  document.body.classList.add("app-shell");
  el.innerHTML = `
    <div class="mobile-bar">
      ${mobileBack}
      <span class="mobile-title">${esc(mobileTitles[path] || "Board Night")}</span>
      <button class="mobile-account" id="mobileSignOutBtn" type="button" aria-label="Sign out">${esc(initials)}</button>
    </div>
    <a class="brand" href="dashboard.html" aria-label="Board Night home">
      <img class="brand-logo" src="css/design_elements/BNlogo.svg" alt="">
      <span>BOARD NIGHT</span>
    </a>
    <nav class="sidebar-nav" aria-label="Main navigation">
      <a class="sidebar-link ${groupsActive ? "is-active" : ""}" href="dashboard.html">
        <span class="sidebar-icon" aria-hidden="true">♟</span><span>Groups</span>
      </a>
      <a class="sidebar-link ${eventsActive ? "is-active" : ""}" href="events.html">
        <span class="sidebar-icon" aria-hidden="true">⚄</span><span>Events</span>
      </a>
      <a class="sidebar-link ${calendarActive ? "is-active" : ""}" href="calendar.html">
        <span class="sidebar-icon" aria-hidden="true">□</span><span>Calendar</span>
      </a>
      <a class="sidebar-link ${friendsActive ? "is-active" : ""}" href="friends.html">
        <span class="sidebar-icon" aria-hidden="true">♡</span><span>Friends</span>
      </a>
      <a class="sidebar-link ${notificationsActive ? "is-active" : ""}" href="notifications.html">
        <span class="sidebar-icon notification-bell" aria-hidden="true">●</span><span>Notifications</span>
        <span class="notification-count" id="notificationCount" hidden></span>
      </a>
    </nav>
    <div class="sidebar-account">
      <div class="account-avatar" aria-hidden="true">${esc(initials)}</div>
      <div class="account-copy">
        <span class="topbar-user">${esc(user ? user.name : "")}</span>
        <button class="nav-signout" id="signOutBtn" type="button">Sign out</button>
      </div>
    </div>`;

  document.getElementById("signOutBtn").addEventListener("click", function () {
    DB.reset();
    window.location.href = "index.html";
  });

  const mobileBackButton = el.querySelector(".mobile-back");
  if (mobileBackButton) mobileBackButton.addEventListener("click", function () { window.history.back(); });
  document.getElementById("mobileSignOutBtn").addEventListener("click", function () {
    DB.reset();
    window.location.href = "index.html";
  });

  startNotificationToasts();
}

function requireSession() {
  if (DB.currentUser()) return true;
  const next = window.location.pathname.split("/").pop() + window.location.search;
  window.location.replace("index.html?next=" + encodeURIComponent(next));
  return false;
}

// Run a function once the DOM is ready
function ready(fn) {
  if (document.readyState !== "loading") fn();
  else document.addEventListener("DOMContentLoaded", fn);
}
