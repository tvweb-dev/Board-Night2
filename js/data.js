/* Board Night — data store (scaffold)
 *
 * This is a TEMPORARY front-end-only store. It keeps everything in the
 * browser's localStorage so the app runs with no backend. When the team
 * is ready, replace these functions with real API/database calls — the
 * rest of the app only talks to the functions below, so the swap is clean.
 *
 * Data shape:
 *   users:   [{ id, name, email }]
 *   groups:  [{ id, name, hostId, memberIds: [] }]
 *   events:  [{ id, groupId, hostId, title, date, time, location, description, cancelled }]
 *   rsvps:   [{ id, eventId, userId, status }]   status = "going" | "maybe" | "no"
 */

const DB = {
  KEY: "boardNightData",

  _seed() {
    return {
      currentUserId: "u1",
      users: [
        { id: "u1", name: "You (Host)", email: "you@example.com" },
        { id: "u2", name: "Sam", email: "sam@example.com" },
        { id: "u3", name: "Riya", email: "riya@example.com" },
      ],
      groups: [
        { id: "g1", name: "Thursday Boardgamers", hostId: "u1", memberIds: ["u1", "u2", "u3"] },
      ],
      events: [
        {
          id: "e1", groupId: "g1", hostId: "u1",
          title: "Catan Night", date: "2026-07-09", time: "19:00",
          location: "Sam's place", description: "Bring snacks!", cancelled: false,
        },
      ],
      rsvps: [
        { id: "r1", eventId: "e1", userId: "u1", status: "going" },
        { id: "r2", eventId: "e1", userId: "u2", status: "maybe" },
      ],
    };
  },

  load() {
    let raw = localStorage.getItem(this.KEY);
    if (!raw) {
      const seed = this._seed();
      localStorage.setItem(this.KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw);
  },

  save(data) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
  },

  reset() {
    localStorage.removeItem(this.KEY);
  },

  _id(prefix) {
    return prefix + Math.random().toString(36).slice(2, 8);
  },

  /* ---- current user ---- */
  currentUser() {
    const d = this.load();
    return d.users.find((u) => u.id === d.currentUserId);
  },

  /* ---- groups ---- */
  getGroups() {
    return this.load().groups;
  },
  getGroup(id) {
    return this.load().groups.find((g) => g.id === id);
  },
  createGroup(name) {
    const d = this.load();
    const g = { id: this._id("g"), name, hostId: d.currentUserId, memberIds: [d.currentUserId] };
    d.groups.push(g);
    this.save(d);
    return g;
  },

  /* ---- members ---- */
  getMembers(groupId) {
    const d = this.load();
    const g = d.groups.find((x) => x.id === groupId);
    if (!g) return [];
    return g.memberIds.map((id) => d.users.find((u) => u.id === id)).filter(Boolean);
  },
  addMember(groupId, name, email) {
    const d = this.load();
    const g = d.groups.find((x) => x.id === groupId);
    if (!g) return null;
    let user = d.users.find((u) => email && u.email === email);
    if (!user) {
      user = { id: this._id("u"), name, email: email || "" };
      d.users.push(user);
    }
    if (!g.memberIds.includes(user.id)) g.memberIds.push(user.id);
    this.save(d);
    return user;
  },

  /* ---- events ---- */
  getEvents(groupId) {
    return this.load().events.filter((e) => e.groupId === groupId);
  },
  getEvent(id) {
    return this.load().events.find((e) => e.id === id);
  },
  createEvent(ev) {
    const d = this.load();
    const e = {
      id: this._id("e"),
      groupId: ev.groupId,
      hostId: d.currentUserId,
      title: ev.title || "Game Night",
      date: ev.date || "",
      time: ev.time || "",
      location: ev.location || "",
      description: ev.description || "",
      cancelled: false,
    };
    d.events.push(e);
    this.save(d);
    return e;
  },
  updateEvent(id, fields) {
    const d = this.load();
    const e = d.events.find((x) => x.id === id);
    if (!e) return null;
    Object.assign(e, fields);
    this.save(d);
    return e;
  },
  cancelEvent(id) {
    return this.updateEvent(id, { cancelled: true });
  },
  changeHost(eventId, newHostId) {
    return this.updateEvent(eventId, { hostId: newHostId });
  },

  /* ---- rsvps ---- */
  getRsvps(eventId) {
    return this.load().rsvps.filter((r) => r.eventId === eventId);
  },
  getRsvpFor(eventId, userId) {
    return this.load().rsvps.find((r) => r.eventId === eventId && r.userId === userId);
  },
  setRsvp(eventId, userId, status) {
    const d = this.load();
    let r = d.rsvps.find((x) => x.eventId === eventId && x.userId === userId);
    if (r) {
      r.status = status;
    } else {
      r = { id: this._id("r"), eventId, userId, status };
      d.rsvps.push(r);
    }
    this.save(d);
    return r;
  },
};
