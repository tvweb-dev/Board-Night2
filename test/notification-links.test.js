const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

test("notification popups link group invitations and event invitations to their destinations", () => {
  const app = read("js/app.js");
  assert.match(app, /GROUP_MEMBER_ADDED[\s\S]*group\.html\?group=/);
  assert.match(app, /EVENT_INVITE[\s\S]*event\.html\?event=/);
  assert.match(app, /notificationDestination\(item\)/);
});

test("group invitation page offers join and decline actions through the API", () => {
  const group = read("group.html");
  const data = read("js/data.js");
  assert.match(group, /id="joinGroupBtn"[\s\S]*Join Group/);
  assert.match(group, /id="declineGroupBtn"[\s\S]*Don't Join Group/);
  assert.match(group, /DB\.respondToGroupInvitation\(invitationId, decision\)/);
  assert.match(data, /\/group-invitation/);
});

test("pending group invitees are labelled as member pending", () => {
  const dashboard = fs.readFileSync(path.join(__dirname, "../dashboard.html"), "utf8");
  const group = fs.readFileSync(path.join(__dirname, "../group.html"), "utf8");
  const data = fs.readFileSync(path.join(__dirname, "../js/data.js"), "utf8");
  assert.match(data, /MEMBER_ROLE[\s\S]*PENDING/);
  assert.match(dashboard, /filter\(function \(group\) \{ return !group\.pending; \}\)/);
  assert.match(group, /Member pending/);
});

test("notification list includes response and RSVP links", () => {
  const page = read("notifications.html");
  assert.match(page, /Respond to invitation/);
  assert.match(page, /Confirm RSVP/);
});

test("notification popup links to the full list when a new batch has additional items", () => {
  const app = read("js/app.js");
  assert.match(app, /unseenItems\.length - 1/);
  assert.match(app, /See \$\{additionalCount\} other new notification/);
  assert.match(app, /class="toast-other-link" href="notifications\.html"/);
});
