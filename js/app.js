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

function prettyTime(timeStr) {
  const value = String(timeStr || "").trim();
  if (!value) return "Time TBD";
  const parts = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!parts) return value;
  const date = new Date(2000, 0, 1, Number(parts[1]), Number(parts[2]));
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function eventDateTime(event) {
  const dateParts = String(event && event.date || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateParts) return null;
  const timeParts = String(event.time || "").trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  let hour = timeParts ? Number(timeParts[1]) : 23;
  const minute = timeParts ? Number(timeParts[2]) : 59;
  const meridiem = timeParts && timeParts[3] ? timeParts[3].toUpperCase() : "";
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]), hour, minute, timeParts ? 0 : 59);
}

function eventDisplayState(event, now = new Date()) {
  const databaseState = String(event && event.displayStatus || "").toUpperCase();
  const cancelled = databaseState === "CANCELED" || Boolean(event && event.cancelled) || ["CANCELED", "CANCELLED"].includes(String(event && event.status || "").toUpperCase());
  const startsAt = eventDateTime(event);
  const past = databaseState === "PAST" || (!databaseState && Boolean(startsAt && now > startsAt));
  const upcoming = databaseState === "UPCOMING" || (!databaseState && !cancelled && !past);
  return { cancelled: cancelled, past: past, upcoming: upcoming };
}

// Map an RSVP status to a label + pill class
const STATUS_LABEL = { going: "Going", maybe: "Maybe", no: "Can't make it" };
const STATUS_CLASS = { going: "going", maybe: "maybe", no: "no" };
const NOTIFICATION_SEEN_KEY = "boardNightSeenNotifications";
const PLACEHOLDER_IMAGE = {
  group: "assets/images/group-placeholder.webp",
  event: "assets/images/event-placeholder.webp",
  profile: "assets/images/profile-placeholder.webp"
};

let siteLoadingCount = 0;
let loadingIndicator = null;

function ensureLoadingIndicator() {
  if (loadingIndicator || !document.body) return;
  loadingIndicator = document.createElement("img");
  loadingIndicator.className = "loading-indicator";
  loadingIndicator.src = "css/design_elements/BN-LOGO-LOADING.gif";
  loadingIndicator.alt = "";
  loadingIndicator.setAttribute("aria-hidden", "true");
  document.body.appendChild(loadingIndicator);
}

function beginSiteLoading() {
  siteLoadingCount += 1;
  ensureLoadingIndicator();
  document.documentElement.classList.add("site-loading");
}

function endSiteLoading() {
  siteLoadingCount = Math.max(0, siteLoadingCount - 1);
  if (!siteLoadingCount) document.documentElement.classList.remove("site-loading");
}

window.beginSiteLoading = beginSiteLoading;
window.endSiteLoading = endSiteLoading;

function initialsFor(name) {
  return String(name || "BN").split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) { return part[0]; }).join("").toUpperCase();
}

function avatarHtml(person, className, style = "") {
  const name = person && (person.name || person.userName) || "Board Night player";
  const imageUrl = person && person.imageUrl || PLACEHOLDER_IMAGE.profile;
  const image = `<img src="${esc(imageUrl)}" alt="">`;
  return `<span class="${esc(className)}"${style ? ` style="${esc(style)}"` : ""} aria-hidden="true">${image}</span>`;
}

function bindImageUpload(fileInputId, urlInputId, type, onUploaded) {
  const fileInput = document.getElementById(fileInputId);
  const urlInput = document.getElementById(urlInputId);
  if (!fileInput || !urlInput) return;
  const status = document.createElement("small");
  status.className = "image-upload-status";
  status.setAttribute("role", "status");
  fileInput.insertAdjacentElement("afterend", status);
  fileInput.addEventListener("change", async function () {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    fileInput.disabled = true;
    status.textContent = "Uploading...";
    try {
      const imageUrl = await DB.uploadImage(file, type);
      urlInput.value = imageUrl;
      urlInput.dispatchEvent(new Event("input", { bubbles: true }));
      status.textContent = "Upload complete";
      if (onUploaded) onUploaded(imageUrl);
    } catch (error) {
      status.textContent = error.message;
      fileInput.value = "";
    } finally { fileInput.disabled = false; }
  });
}

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

  function show(item, additionalCount) {
    const existing = document.getElementById("notificationToast");
    if (existing) existing.remove();
    const toast = document.createElement("aside");
    toast.className = "notification-toast";
    toast.id = "notificationToast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.innerHTML = `
      <span class="toast-indicator" aria-hidden="true"></span>
      <div class="toast-content">
        <a class="toast-copy" href="${esc(notificationDestination(item))}">
          <strong>${esc(item.TITLE || "New notification")}</strong>
          <span>${esc(item.MESSAGE || "You have a new Board Night update.")}</span>
        </a>
        ${additionalCount > 0 ? `<a class="toast-other-link" href="notifications.html">See ${additionalCount} other new notification${additionalCount === 1 ? "" : "s"}</a>` : ""}
      </div>
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
      const mobileCount = document.getElementById("mobileNotificationCount");
      if (mobileCount) {
        mobileCount.textContent = items.length > 99 ? "99+" : String(items.length);
        mobileCount.hidden = items.length === 0;
      }
      const seen = seenIds();
      const unseenItems = items.filter(function (item) { return !seen.has(String(item.NOTIFICATION_ID)); });
      if (!unseenItems.length) return;
      items.forEach(function (item) { remember(item.NOTIFICATION_ID); });
      show(unseenItems[0], unseenItems.length - 1);
    } catch (_) {}
  }

  check();
  window.setInterval(check, 30000);
}

function notificationDestination(item) {
  const type = String(item && item.TYPE || "").toUpperCase();
  if (type === "GROUP_MEMBER_ADDED" && item.GROUP_ID) {
    return `group.html?group=${encodeURIComponent(item.GROUP_ID)}&invitation=${encodeURIComponent(item.NOTIFICATION_ID)}`;
  }
  if ((type === "EVENT_INVITE" || type === "RSVP_CHANGED") && item.EVENT_ID) {
    return `event.html?event=${encodeURIComponent(item.EVENT_ID)}`;
  }
  return "notifications.html";
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
  const profileActive = path === "profile.html";
  const mobileTitles = {
    "dashboard.html": "Your Groups",
    "events.html": "Events",
    "calendar.html": "Calendar",
    "friends.html": "Friends",
    "notifications.html": "Notifications",
    "profile.html": "Profile",
    "group.html": "Group",
    "event.html": "Event",
    "event-edit.html": qs("event") ? "Edit Event" : "Create Event"
  };
  const mobileBack = path === "dashboard.html" ? "" :
    `<button class="mobile-back" type="button" aria-label="Go back">‹</button>`;
  const initials = user && user.name
    ? user.name.split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) { return part[0]; }).join("").toUpperCase()
    : "BN";

  document.body.classList.add("app-shell", `page-${path.replace(".html", "")}`);
  el.innerHTML = `
    <div class="mobile-bar">
      ${mobileBack}
      <a class="mobile-brand" href="dashboard.html" aria-label="Board Night home">
        <img src="css/design_elements/BNlogo.svg" alt="">
        <span>BOARD NIGHT</span>
      </a>
      <a class="mobile-notifications" href="notifications.html" aria-label="Notifications">
        <span aria-hidden="true">●</span>
        <span class="notification-count mobile-notification-count" id="mobileNotificationCount" hidden></span>
      </a>
      <a class="mobile-account" href="profile.html?user=${encodeURIComponent(user.id)}" aria-label="View your profile">${esc(initials)}</a>
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
      <a class="sidebar-link ${profileActive ? "is-active" : ""}" href="profile.html?user=${encodeURIComponent(user.id)}">
        <span class="sidebar-icon" aria-hidden="true">◎</span><span>Profile</span>
      </a>
    </nav>
    <div class="sidebar-account">
      <div class="account-avatar" aria-hidden="true">${esc(initials)}</div>
      <div class="account-copy">
        <a class="topbar-user" href="profile.html?user=${encodeURIComponent(user.id)}">${esc(user ? user.name : "")}</a>
        <button class="nav-signout" id="signOutBtn" type="button">Sign out</button>
      </div>
    </div>`;

  const mobileNav = document.createElement("nav");
  mobileNav.className = "mobile-bottom-nav";
  mobileNav.setAttribute("aria-label", "Mobile navigation");
  mobileNav.innerHTML = `
    <a class="mobile-nav-link ${groupsActive ? "is-active" : ""}" href="dashboard.html"><span aria-hidden="true">♟</span><small>Groups</small></a>
    <a class="mobile-nav-link ${eventsActive ? "is-active" : ""}" href="events.html"><span aria-hidden="true">⚄</span><small>Events</small></a>
    <a class="mobile-nav-home" href="dashboard.html" aria-label="Board Night home"><img src="css/design_elements/BNlogo.svg" alt=""></a>
    <a class="mobile-nav-link ${calendarActive ? "is-active" : ""}" href="calendar.html"><span aria-hidden="true">□</span><small>Calendar</small></a>
    <a class="mobile-nav-link ${friendsActive ? "is-active" : ""}" href="friends.html"><span aria-hidden="true">♡</span><small>Friends</small></a>`;
  document.body.appendChild(mobileNav);

  document.getElementById("signOutBtn").addEventListener("click", function () {
    DB.reset();
    window.location.href = "index.html";
  });

  const mobileBackButton = el.querySelector(".mobile-back");
  if (mobileBackButton) mobileBackButton.addEventListener("click", function () { window.history.back(); });
  startNotificationToasts();

  DB.getProfile(user.id).then(function (profile) {
    const name = DB.displayName(profile);
    const imageUrl = profile.IMAGE_URL || PLACEHOLDER_IMAGE.profile;
    const desktopAvatar = el.querySelector(".account-avatar");
    const mobileAvatar = el.querySelector(".mobile-account");
    const userName = el.querySelector(".topbar-user");
    if (desktopAvatar) desktopAvatar.innerHTML = `<img src="${esc(imageUrl)}" alt="">`;
    if (mobileAvatar) mobileAvatar.innerHTML = `<img src="${esc(imageUrl)}" alt="">`;
    if (userName) userName.textContent = name;
  }).catch(function () {});
}

function requireSession() {
  if (DB.currentUser()) return true;
  const next = window.location.pathname.split("/").pop() + window.location.search;
  window.location.replace("index.html?next=" + encodeURIComponent(next));
  return false;
}

// Run a function once the DOM is ready
function ready(fn) {
  function run() {
    beginSiteLoading();
    Promise.resolve().then(fn).finally(endSiteLoading);
  }
  if (document.readyState !== "loading") run();
  else document.addEventListener("DOMContentLoaded", run, { once: true });
}
