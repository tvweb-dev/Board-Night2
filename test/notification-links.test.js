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

test("notification list includes response and RSVP links", () => {
  const page = read("notifications.html");
  assert.match(page, /Respond to invitation/);
  assert.match(page, /Confirm RSVP/);
});
