/* Board Night - API-backed data layer */

const API_BASE_URL = window.BOARD_NIGHT_API_URL || "https://board-night-server-594j5.ondigitalocean.app";

const DB = {
  SESSION_KEY: "boardNightSession",

  async api(path, options = {}) {
    const response = await fetch(API_BASE_URL + path, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    const payload = await response.json().catch(() => ({
      success: false,
      message: "Invalid server response"
    }));

    if (!response.ok || payload.success === false) {
      throw new Error(payload.message || "API request failed");
    }

    return payload.data;
  },

  load() {
    return {
      currentUserId: this.currentUserId(),
      users: []
    };
  },

  reset() {
    localStorage.removeItem(this.SESSION_KEY);
  },

  currentUserId() {
    const user = this.currentUser();
    return user ? user.id : 1;
  },

  currentUser() {
    const raw = localStorage.getItem(this.SESSION_KEY);
    if (!raw) {
      return {
        id: 1,
        name: "User 1",
        email: ""
      };
    }

    const session = JSON.parse(raw);
    return {
      id: session.USER_ID,
      name: session.EMAIL || `User ${session.USER_ID}`,
      email: session.EMAIL || ""
    };
  },

  saveSession(user) {
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
  },

  async login(email, password) {
    const user = await this.api("/api/users/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    this.saveSession(user);
    return this.currentUser();
  },

  async createUser(email, password) {
    return this.api("/api/users", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },

  /* ---- groups ---- */
  async getGroups() {
    const groups = await this.api(`/api/groups/user/${this.currentUserId()}`);
    return groups.map(this.mapGroup);
  },

  async getGroup(id) {
    const groups = await this.getGroups();
    return groups.find((g) => String(g.id) === String(id)) || null;
  },

  async createGroup(name) {
    const created = await this.api("/api/groups", {
      method: "POST",
      body: JSON.stringify({
        groupName: name,
        createdBy: this.currentUserId()
      })
    });

    return {
      id: created.GROUP_ID,
      name,
      hostId: this.currentUserId()
    };
  },

  mapGroup(row) {
    return {
      id: row.GROUP_ID,
      name: row.GROUP_NAME,
      hostId: row.CREATED_BY,
      memberRole: row.MEMBER_ROLE,
      createdAt: row.CREATED_AT
    };
  },

  /* ---- members ---- */
  async getMembers(groupId) {
    const members = await this.api(`/api/groups/${groupId}/members`);
    return members.map((row) => ({
      id: row.USER_ID,
      name: row.EMAIL || `User ${row.USER_ID}`,
      email: row.EMAIL || "",
      role: row.MEMBER_ROLE
    }));
  },

  async addMember(groupId, name, email) {
    let userId = Number(name);

    if (!userId) {
      const created = await this.createUser(email || `${Date.now()}@board-night.local`, "password123");
      userId = created.USER_ID;
    }

    await this.api("/api/groups/members", {
      method: "POST",
      body: JSON.stringify({
        groupId,
        userId,
        memberRole: "MEMBER"
      })
    });

    return {
      id: userId,
      name: email || `User ${userId}`,
      email: email || ""
    };
  },

  /* ---- events ---- */
  async getEvents(groupId) {
    const events = await this.api(`/api/events/group/${groupId}`);
    return events.map(this.mapEvent);
  },

  async getEvent(id) {
    const groups = await this.getGroups();

    for (const group of groups) {
      const events = await this.getEvents(group.id);
      const event = events.find((e) => String(e.id) === String(id));
      if (event) return event;
    }

    return null;
  },

  async createEvent(ev) {
    const created = await this.api("/api/events", {
      method: "POST",
      body: JSON.stringify({
        groupId: ev.groupId,
        hostId: this.currentUserId(),
        eventTitle: ev.title || "Game Night",
        eventDate: ev.date || "",
        eventTime: ev.time || "",
        eventLocation: ev.location || ""
      })
    });

    return {
      id: created.EVENT_ID,
      groupId: ev.groupId,
      hostId: this.currentUserId(),
      title: ev.title || "Game Night",
      date: ev.date || "",
      time: ev.time || "",
      location: ev.location || "",
      description: ev.description || "",
      cancelled: false
    };
  },

  async updateEvent(id, fields) {
    alert("Editing existing events is not in the MVP API yet.");
    return {
      id,
      ...fields
    };
  },

  async cancelEvent() {
    alert("Cancelling events is not in the MVP API yet.");
  },

  async changeHost() {
    alert("Changing hosts is not in the MVP API yet.");
  },

  mapEvent(row) {
    return {
      id: row.EVENT_ID,
      groupId: row.GROUP_ID,
      hostId: row.HOST_ID,
      hostEmail: row.HOST_EMAIL,
      title: row.EVENT_TITLE,
      date: row.EVENT_DATE ? String(row.EVENT_DATE).slice(0, 10) : "",
      time: row.EVENT_TIME || "",
      location: row.EVENT_LOCATION || "",
      description: "",
      cancelled: row.EVENT_STATUS === "CANCELLED"
    };
  },

  /* ---- rsvps ---- */
  async getRsvps(eventId) {
    const rsvps = await this.api(`/api/events/${eventId}/rsvps`);
    return rsvps.map((row) => ({
      id: row.INVITE_ID,
      eventId: row.EVENT_ID,
      userId: row.USER_ID,
      userName: row.EMAIL || `User ${row.USER_ID}`,
      userEmail: row.EMAIL || "",
      status: this.fromApiStatus(row.RSVP_STATUS)
    }));
  },

  async getRsvpFor(eventId, userId) {
    const rsvps = await this.getRsvps(eventId);
    return rsvps.find((r) => String(r.userId) === String(userId)) || null;
  },

  async inviteToEvent(eventId, userId) {
    const existing = await this.getRsvpFor(eventId, userId);
    if (existing) return existing;

    const invite = await this.api("/api/invites", {
      method: "POST",
      body: JSON.stringify({ eventId, userId })
    });

    return {
      id: invite.INVITE_ID,
      eventId,
      userId,
      status: "pending"
    };
  },

  async setRsvp(eventId, userId, status) {
    const existing = await this.getRsvpFor(eventId, userId);
    const invite = existing || await this.api("/api/invites", {
      method: "POST",
      body: JSON.stringify({ eventId, userId })
    });

    const inviteId = existing ? existing.id : invite.INVITE_ID;

    await this.api("/api/invites/rsvp", {
      method: "PUT",
      body: JSON.stringify({
        inviteId,
        rsvpStatus: this.toApiStatus(status)
      })
    });

    return {
      id: inviteId,
      eventId,
      userId,
      status
    };
  },

  toApiStatus(status) {
    return {
      going: "GOING",
      maybe: "MAYBE",
      no: "NOT_GOING"
    }[status] || "PENDING";
  },

  fromApiStatus(status) {
    return {
      GOING: "going",
      MAYBE: "maybe",
      NOT_GOING: "no",
      PENDING: "pending"
    }[status] || "pending";
  }
};
