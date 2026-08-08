/* Board Night - API-backed data layer */

const API_BASE_URL = window.BOARD_NIGHT_API_URL || "https://board-night-server-594j5.ondigitalocean.app";

const DB = {
  SESSION_KEY: "boardNightSession",
  CREATED_EVENT_RSVP_KEY: "boardNightCreatedEventRsvp",

  async api(path, options = {}) {
    const rawSession = localStorage.getItem(this.SESSION_KEY);
    let session = null;
    try { session = rawSession ? JSON.parse(rawSession) : null; } catch (_) { this.reset(); }
    const response = await fetch(API_BASE_URL + path, {
      headers: {
        "Content-Type": "application/json",
        ...(session && session.token ? { Authorization: `Bearer ${session.token}` } : {}),
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

    return payload.data === undefined ? payload : payload.data;
  },

  async uploadImage(file, type) {
    if (!file || !String(file.type || "").startsWith("image/")) throw new Error("Choose a valid image file");
    if (file.size > 10 * 1024 * 1024) throw new Error("Image must be 10 MB or smaller");
    const signed = await this.api("/api/uploads/signature", { method: "POST", body: JSON.stringify({ type }) });
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", signed.apiKey);
    form.append("timestamp", String(signed.timestamp));
    form.append("folder", signed.folder);
    form.append("signature", signed.signature);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/image/upload`, { method: "POST", body: form });
    const result = await response.json().catch(function () { return {}; });
    if (!response.ok || !result.secure_url) throw new Error(result.error && result.error.message || "Image upload failed");
    return result.secure_url;
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
    return user ? user.id : null;
  },

  currentUser() {
    const raw = localStorage.getItem(this.SESSION_KEY);
    if (!raw) {
      return null;
    }

    let session;
    try { session = JSON.parse(raw); } catch (_) { this.reset(); return null; }
    if (!session.USER_ID || !session.token) return null;
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

  displayName(row) {
    const fullName = [row.FIRST_NAME, row.LAST_NAME].filter(Boolean).join(" ");
    return row.NICKNAME || fullName || row.EMAIL || `User ${row.USER_ID}`;
  },

  async register(email, password) {
    await this.createUser(email, password);
    return this.login(email, password);
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

  async createGroup(name, imageUrl = "") {
    const created = await this.api("/api/groups", {
      method: "POST",
      body: JSON.stringify({
        groupName: name,
        groupImageUrl: imageUrl
      })
    });

    return {
      id: created.GROUP_ID,
      name,
      hostId: this.currentUserId(),
      imageUrl: created.GROUP_IMAGE_URL || imageUrl
    };
  },

  mapGroup(row) {
    return {
      id: row.GROUP_ID,
      name: row.GROUP_NAME,
      hostId: row.CREATED_BY,
      memberRole: row.MEMBER_ROLE,
      imageUrl: row.GROUP_IMAGE_URL || "",
      createdAt: row.CREATED_AT
    };
  },

  async updateGroupImage(groupId, groupImageUrl) {
    return this.api(`/api/groups/${groupId}/image`, {
      method: "PATCH",
      body: JSON.stringify({ groupImageUrl })
    });
  },

  /* ---- members ---- */
  async getMembers(groupId) {
    const members = await this.api(`/api/groups/${groupId}/members`);
    return members.map((row) => ({
      id: row.USER_ID,
      name: this.displayName(row),
      email: row.EMAIL || "",
      imageUrl: row.IMAGE_URL || "",
      role: row.MEMBER_ROLE
    }));
  },

  async addMember(groupId, memberQuery) {
    return this.api("/api/groups/members", {
      method: "POST",
      body: JSON.stringify({
        groupId,
        memberQuery,
        memberRole: "MEMBER"
      })
    });
  },

  async removeMember(groupId, userId) {
    return this.api(`/api/groups/${groupId}/members/${userId}`, { method: "DELETE" });
  },

  /* ---- events ---- */
  async getEvents(groupId) {
    const events = await this.api(`/api/events/group/${groupId}`);
    return events.map(this.mapEvent);
  },

  async getAllEvents() {
    const events = await this.api("/api/events");
    return events.map((row) => ({ ...this.mapEvent(row), groupName: row.GROUP_NAME || "Group" }));
  },

  async getFriends() {
    const friends = await this.api("/api/friends");
    return friends.map((row) => ({
      id: row.USER_ID,
      name: this.displayName(row),
      email: row.EMAIL || "",
      imageUrl: row.IMAGE_URL || "",
      sharedGroupCount: Number(row.SHARED_GROUP_COUNT) || 0,
      friendsSince: row.FRIENDS_SINCE || "",
      hidden: Boolean(Number(row.IS_HIDDEN)),
      note: row.FRIEND_NOTE || ""
    }));
  },

  async setFriendHidden(friendId, hidden) {
    return this.api(`/api/friends/${friendId}/hidden`, {
      method: "PATCH",
      body: JSON.stringify({ hidden: Boolean(hidden) })
    });
  },

  async saveFriendNote(friendId, note) {
    return this.api(`/api/friends/${friendId}/note`, {
      method: "PUT",
      body: JSON.stringify({ note })
    });
  },

  async getAvailability(startDate, endDate) {
    const rows = await this.api(`/api/availability?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`);
    return rows.map((row) => ({
      id: row.AVAILABILITY_ID,
      userId: row.USER_ID,
      userName: this.displayName(row),
      imageUrl: row.IMAGE_URL || "",
      date: row.AVAILABILITY_DATE ? String(row.AVAILABILITY_DATE).slice(0, 10) : "",
      status: String(row.AVAILABILITY_STATUS || "").toLowerCase(),
      startTime: row.START_TIME || "",
      endTime: row.END_TIME || "",
      note: row.NOTE || ""
    }));
  },

  async saveAvailability(date, availability) {
    return this.api(`/api/availability/${encodeURIComponent(date)}`, {
      method: "PUT",
      body: JSON.stringify(availability)
    });
  },

  /* ---- profiles ---- */
  async getProfile(userId) {
    return this.api(`/api/profiles/${userId}`);
  },

  async saveProfile(userId, profile) {
    return this.api(`/api/profiles/${userId}`, {
      method: "PUT",
      body: JSON.stringify(profile)
    });
  },

  async getGames() {
    return this.api("/api/games");
  },

  async getFavoriteGames(userId) {
    return this.api(`/api/games/favorites/${userId}`);
  },

  async replaceFavoriteGames(userId, gameIds) {
    return this.api(`/api/games/favorites/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ gameIds })
    });
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
        eventTitle: ev.title || "Game Night",
        eventDescription: ev.description || "",
        eventDate: ev.date || "",
        eventTime: ev.time || "",
        eventLocation: ev.location || "",
        eventImageUrl: ev.imageUrl || "",
        rehostedFromEventId: ev.rehostedFromEventId || null
      })
    });

    const hostRsvpStatus = this.fromApiStatus(created.HOST_RSVP_STATUS);
    sessionStorage.setItem(this.CREATED_EVENT_RSVP_KEY, JSON.stringify({
      eventId: created.EVENT_ID,
      userId: this.currentUserId(),
      status: hostRsvpStatus
    }));

    return {
      id: created.EVENT_ID,
      groupId: ev.groupId,
      hostId: this.currentUserId(),
      title: ev.title || "Game Night",
      date: ev.date || "",
      time: ev.time || "",
      location: ev.location || "",
      imageUrl: created.EVENT_IMAGE_URL || ev.imageUrl || "",
      EVENT_DESCRIPTION: created.EVENT_DESCRIPTION ?? null,
      description: created.EVENT_DESCRIPTION || ev.description || "",
      status: created.EVENT_STATUS || "ACTIVE",
      cancelled: ["CANCELED", "CANCELLED"].includes(created.EVENT_STATUS),
      displayStatus: created.DISPLAY_STATUS || "UPCOMING",
      rehostedFromEventId: created.REHOSTED_FROM_EVENT_ID || ev.rehostedFromEventId || null,
      hostRsvpStatus
    };
  },

  async updateEvent(id, fields) {
    const updated = await this.api(`/api/events/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        eventTitle: fields.title,
        eventDescription: fields.description || "",
        eventDate: fields.date,
        eventTime: fields.time,
        eventLocation: fields.location,
        eventImageUrl: fields.imageUrl || ""
      })
    });
    return this.mapEvent(updated);
  },

  async updateEventImage(eventId, eventImageUrl) {
    return this.api(`/api/events/${eventId}/image`, {
      method: "PATCH",
      body: JSON.stringify({ eventImageUrl })
    });
  },

  async cancelEvent(eventId) {
    const response = await this.api(`/api/events/${eventId}/cancel`, { method: "PATCH" });
    return response.event || response;
  },

  async changeHost(eventId, newHostId) {
    const response = await this.api(`/api/events/${eventId}/host`, {
      method: "PATCH",
      body: JSON.stringify({ newHostId: Number(newHostId) })
    });
    return response.event || response;
  },

  mapEvent(row) {
    return {
      id: row.EVENT_ID,
      groupId: row.GROUP_ID,
      hostId: row.HOST_ID,
      hostEmail: row.HOST_EMAIL,
      hostName: row.HOST_NICKNAME || [row.HOST_FIRST_NAME, row.HOST_LAST_NAME].filter(Boolean).join(" ") || row.HOST_EMAIL,
      hostImageUrl: row.HOST_IMAGE_URL || "",
      title: row.EVENT_TITLE,
      date: row.EVENT_DATE ? String(row.EVENT_DATE).slice(0, 10) : "",
      time: row.EVENT_TIME || "",
      location: row.EVENT_LOCATION || "",
      imageUrl: row.EVENT_IMAGE_URL || "",
      EVENT_DESCRIPTION: row.EVENT_DESCRIPTION ?? null,
      description: row.EVENT_DESCRIPTION || "",
      status: row.EVENT_STATUS || "ACTIVE",
      cancelled: ["CANCELED", "CANCELLED"].includes(row.EVENT_STATUS),
      displayStatus: row.DISPLAY_STATUS || "",
      rehostedFromEventId: row.REHOSTED_FROM_EVENT_ID || null
    };
  },

  /* ---- rsvps ---- */
  async getRsvps(eventId) {
    const rsvps = await this.api(`/api/events/${eventId}/rsvps`);
    let mapped = rsvps.map((row) => ({
      id: row.INVITE_ID,
      eventId: row.EVENT_ID,
      userId: row.USER_ID,
      userName: this.displayName(row),
      userEmail: row.EMAIL || "",
      imageUrl: row.IMAGE_URL || "",
      status: this.fromApiStatus(row.RSVP_STATUS),
      emailStatus: row.EMAIL_STATUS || row.INVITE_EMAIL_STATUS || "",
      emailSentAt: row.EMAIL_SENT_AT || row.INVITE_EMAIL_SENT_AT || null
    }));

    const rawCreatedRsvp = sessionStorage.getItem(this.CREATED_EVENT_RSVP_KEY);
    const createdRsvp = rawCreatedRsvp ? JSON.parse(rawCreatedRsvp) : null;

    if (createdRsvp && String(createdRsvp.eventId) === String(eventId)) {
      // The create-event response is authoritative for the host's initial RSVP.
      // Replace any pending invite row for the host instead of showing both.
      mapped = mapped.filter((rsvp) => String(rsvp.userId) !== String(createdRsvp.userId));
      const host = this.currentUser();
      mapped.unshift({
        id: null,
        eventId: Number(eventId),
        userId: createdRsvp.userId,
        userName: host.name,
        userEmail: host.email,
        imageUrl: "",
        status: createdRsvp.status,
        emailStatus: "",
        emailSentAt: null
      });
      sessionStorage.removeItem(this.CREATED_EVENT_RSVP_KEY);
    }

    return mapped;
  },

  async getRsvpFor(eventId, userId) {
    const rsvps = await this.getRsvps(eventId);
    return rsvps.find((r) => String(r.userId) === String(userId)) || null;
  },

  async inviteToEvent(eventId, userId) {
    const existing = await this.getRsvpFor(eventId, userId);
    const invite = existing || await this.api("/api/invites", {
        method: "POST",
        body: JSON.stringify({ eventId, userId })
      });
    const inviteId = existing ? existing.id : invite.INVITE_ID;

    return {
      id: inviteId,
      eventId,
      userId,
      status: "pending",
      emailStatus: "PENDING",
      emailSentAt: null
    };
  },

  async sendInviteEmail(inviteId) {
    return this.api(`/api/invites/${inviteId}/send-email`, {
      method: "POST"
    });
  },

  async setRsvp(eventId, userId, status, knownInviteId = null) {
    const existing = await this.getRsvpFor(eventId, userId);
    const invite = (existing || knownInviteId) ? null : await this.api("/api/invites", {
      method: "POST",
      body: JSON.stringify({ eventId, userId })
    });

    const inviteId = knownInviteId || (existing ? existing.id : invite.INVITE_ID);

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
  },

  /* ---- notifications ---- */
  async getNotifications(unreadOnly = false) {
    return this.api(`/api/notifications${unreadOnly ? "?unread=true" : ""}`);
  },

  async markNotificationRead(notificationId) {
    return this.api(`/api/notifications/${notificationId}/read`, { method: "PATCH" });
  },

  async markAllNotificationsRead() {
    return this.api("/api/notifications/read-all", { method: "PATCH" });
  }
};
