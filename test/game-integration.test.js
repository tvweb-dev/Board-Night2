const test = require("node:test");
const assert = require("node:assert/strict");

function storage(values = {}) {
  const entries = new Map(Object.entries(values));
  return {
    getItem: (key) => entries.has(key) ? entries.get(key) : null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key)
  };
}

global.localStorage = storage({ boardNightSession: JSON.stringify({ USER_ID: 7, EMAIL: "player@example.com", token: "secret-token" }) });
global.sessionStorage = storage();
const DB = require("../js/data.js");
const GamePicker = require("../js/game-picker.js");

function response(data, options = {}) {
  return { ok: options.ok !== false, json: async () => ({ success: options.success !== false, data, message: options.message }) };
}

test("authenticated API calls retain the existing bearer token", async () => {
  let request;
  global.fetch = async (url, options) => { request = { url, options }; return response([]); };
  await DB.searchGames("catan", 10);
  assert.match(request.url, /\/api\/games\/search\?q=catan&limit=10$/);
  assert.equal(request.options.headers.Authorization, "Bearer secret-token");
});

test("blank game searches do not call the API", async () => {
  let calls = 0;
  global.fetch = async () => { calls += 1; return response([]); };
  assert.deepEqual(await DB.searchGames("   "), []);
  assert.equal(calls, 0);
});

test("game search encodes the query and clamps the limit", async () => {
  let url;
  global.fetch = async (value) => { url = value; return response([]); };
  await DB.searchGames("ticket to ride", 100);
  assert.match(url, /q=ticket%20to%20ride&limit=50$/);
});

test("game details use the authenticated game detail endpoint", async () => {
  let url;
  global.fetch = async (value) => { url = value; return response({ GAME_ID: 1, GAME_NAME: "Catan" }); };
  const game = await DB.getGame(1);
  assert.match(url, /\/api\/games\/1$/);
  assert.equal(game.GAME_NAME, "Catan");
});

test("debounced search only runs the latest query", async () => {
  const values = [];
  const run = GamePicker.debounce((value) => values.push(value), 15);
  run("ca"); run("cat"); run("catan");
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.deepEqual(values, ["catan"]);
});

test("compact game metadata and rating render enriched fields", () => {
  const game = { MIN_PLAYERS: 3, MAX_PLAYERS: 4, MIN_PLAYTIME: 60, MAX_PLAYTIME: 120, AVERAGE_RATING: 7.14 };
  assert.deepEqual(GamePicker.compactMeta(game), ["3–4 players", "60–120 min"]);
  assert.equal(GamePicker.rating(game), "★ 7.1");
});

test("compact images prefer thumbnails and support fallback", () => {
  assert.equal(GamePicker.imageUrl({ THUMBNAIL_URL: "thumb.jpg", IMAGE_URL: "large.jpg" }), "thumb.jpg");
  assert.equal(GamePicker.imageUrl({}, false), "assets/images/event-placeholder.webp");
});

test("favorite writes use the existing relationship endpoint", async () => {
  let request;
  global.fetch = async (url, options) => { request = { url, options }; return response([]); };
  await DB.replaceFavoriteGames(7, [1, 2]);
  assert.match(request.url, /\/api\/games\/favorites\/7$/);
  assert.equal(request.options.method, "PUT");
  assert.deepEqual(JSON.parse(request.options.body), { gameIds: [1, 2] });
});

test("event creation sends null when no game is selected", async () => {
  let body;
  global.fetch = async (url, options) => { body = JSON.parse(options.body); return response({ EVENT_ID: 11, HOST_RSVP_STATUS: "GOING" }); };
  await DB.createEvent({ groupId: 2, title: "Game night" });
  assert.equal(body.gameId, null);
});

test("event creation sends the selected GAME_ID", async () => {
  let body;
  global.fetch = async (url, options) => { body = JSON.parse(options.body); return response({ EVENT_ID: 12, GAME_ID: 1, HOST_RSVP_STATUS: "GOING" }); };
  const created = await DB.createEvent({ groupId: 2, title: "Catan night", gameId: 1 });
  assert.equal(body.gameId, 1);
  assert.equal(created.gameId, 1);
});

test("event mapping handles nested and null games", () => {
  const game = { GAME_ID: 1, GAME_NAME: "Catan", THUMBNAIL_URL: "catan.jpg" };
  assert.equal(DB.mapEvent({ EVENT_ID: 1, GAME_ID: 1, GAME: game }).game, game);
  assert.equal(DB.mapEvent({ EVENT_ID: 2, GAME_ID: null, GAME: null }).game, null);
});

test("event detail uses the direct endpoint and preserves nested GAME", async () => {
  let url;
  global.fetch = async (value) => { url = value; return response({ EVENT_ID: 9, GAME_ID: 1, GAME: { GAME_ID: 1, GAME_NAME: "Catan" } }); };
  const event = await DB.getEvent(9);
  assert.match(url, /\/api\/events\/9$/);
  assert.equal(event.game.GAME_NAME, "Catan");
});

test("host game changes PATCH a valid GAME_ID", async () => {
  let request;
  global.fetch = async (url, options) => { request = { url, options }; return response({ EVENT_ID: 3, GAME_ID: 2, GAME: { GAME_ID: 2, GAME_NAME: "Risk" } }); };
  const updated = await DB.updateEventGame(3, 2);
  assert.match(request.url, /\/api\/events\/3\/game$/);
  assert.equal(request.options.method, "PATCH");
  assert.deepEqual(JSON.parse(request.options.body), { gameId: 2 });
  assert.equal(updated.gameId, 2);
});

test("host game removal PATCHes null", async () => {
  let body;
  global.fetch = async (url, options) => { body = JSON.parse(options.body); return response({ EVENT_ID: 3, GAME_ID: null, GAME: null }); };
  await DB.updateEventGame(3, null);
  assert.deepEqual(body, { gameId: null });
});

test("API failures reject without fabricating data", async () => {
  global.fetch = async () => response(null, { ok: false, success: false, message: "Unable to search" });
  await assert.rejects(DB.searchGames("catan"), /Unable to search/);
});
