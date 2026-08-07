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
  const mobileTitles = {
    "dashboard.html": "Your Groups",
    "events.html": "Events",
    "calendar.html": "Calendar",
    "friends.html": "Friends",
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
