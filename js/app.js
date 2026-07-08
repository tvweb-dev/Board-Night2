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

// Shared top navigation bar
function renderTopbar() {
  const el = document.getElementById("topbar");
  if (!el) return;
  const user = DB.currentUser();
  el.innerHTML = `
    <div class="brand">🎲 Board Night</div>
    <nav>
      <a href="dashboard.html">Dashboard</a>
      <span class="subtle" style="margin-left:16px;color:#ffd9cf">${esc(user ? user.name : "")}</span>
    </nav>`;
}

// Run a function once the DOM is ready
function ready(fn) {
  if (document.readyState !== "loading") fn();
  else document.addEventListener("DOMContentLoaded", fn);
}
