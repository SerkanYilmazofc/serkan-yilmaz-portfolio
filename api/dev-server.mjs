/**
 * Local analytics API (no PHP). Stores real visit data in api/.data/store.json
 * Run: npm run dev:api
 * Vite proxies /api → http://127.0.0.1:8080
 */
import http from "node:http";
import { randomBytes } from "node:crypto";
import { URL } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8080;
const USER = process.env.DEFAULT_ADMIN_USER || "admin";
const PASS = process.env.DEFAULT_ADMIN_PASSWORD || "Admin123!temp";
const ONLINE_SEC = 60;
const DATA_DIR = path.join(__dirname, ".data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

/** @type {Map<string, { csrf: string, username: string, created: number }>} */
const sessions = new Map();

/** @typedef {{
 *  visitors: Record<string, { visitor_id: string, first_seen: string, last_seen: string, is_bot: boolean }>,
 *  sessions: Record<string, object>,
 *  pageviews: object[],
 *  audit: object[],
 * }} Store */

/** @returns {Store} */
function emptyStore() {
  return { visitors: {}, sessions: {}, pageviews: [], audit: [] };
}

/** @type {Store} */
let store = emptyStore();

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      store = { ...emptyStore(), ...JSON.parse(fs.readFileSync(STORE_FILE, "utf8")) };
      store.visitors ||= {};
      store.sessions ||= {};
      store.pageviews ||= [];
      store.audit ||= [];
    }
  } catch {
    store = emptyStore();
  }
}

function saveStore() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(store), "utf8");
  } catch (e) {
    console.error("[dev-api] save failed", e);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function isBot(ua = "") {
  return /bot|crawl|spider|slurp|wget|curl|python-requests|headless/i.test(ua);
}

function parseUa(ua = "") {
  let browser = "Other";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  let os = "Other";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  let device = "Desktop";
  if (/Mobile|iPhone|Android.*Mobile/i.test(ua)) device = "Mobile";
  else if (/iPad|Tablet/i.test(ua)) device = "Tablet";
  return { browser, os, device, is_bot: isBot(ua) };
}

function classifySource(referrer, utm) {
  if (utm.utm_source || utm.utm_campaign) return "UTM Campaign";
  if (!referrer) return "Direct";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (host.includes("google.")) return "Google";
    if (host.includes("bing.com")) return "Bing";
    if (host.includes("youtube") || host.includes("youtu.be")) return "YouTube";
    if (host.includes("instagram")) return "Instagram";
    if (host.includes("facebook") || host.includes("fb.com")) return "Facebook";
    if (host.includes("linkedin")) return "LinkedIn";
    if (host.includes("twitter") || host === "x.com" || host === "t.co") return "X / Twitter";
    if (host.includes("github")) return "GitHub";
    return "Referral";
  } catch {
    return "Direct";
  }
}

function refDomain(referrer) {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function validUuid(v) {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function sanitizePath(p = "/") {
  let pathStr = String(p || "/").split("?")[0].split("#")[0];
  if (!pathStr.startsWith("/")) pathStr = `/${pathStr}`;
  return pathStr.slice(0, 255) || "/";
}

const CITY_COORDS = {
  "türkiye|kayseri": [38.73, 35.49],
  "türkiye|istanbul": [41.01, 28.98],
  "türkiye|ankara": [39.93, 32.86],
  "germany|berlin": [52.52, 13.4],
  "united states|new york": [40.71, -74],
};

function approxCoords(country, city) {
  const key = `${(country || "").toLowerCase()}|${(city || "").toLowerCase()}`;
  return CITY_COORDS[key] || [null, null];
}

function ingestVisit(body, ua) {
  const visitorId = validUuid(body.visitor_id) ? body.visitor_id.toLowerCase() : null;
  const sessionId = validUuid(body.session_id) ? body.session_id.toLowerCase() : null;
  if (!visitorId || !sessionId) return { error: "Invalid ids" };
  const parsed = parseUa(ua);
  const pathStr = sanitizePath(body.path);
  const now = nowIso();
  const utm = {
    utm_source: body.utm_source || null,
    utm_medium: body.utm_medium || null,
    utm_campaign: body.utm_campaign || null,
    utm_content: body.utm_content || null,
    utm_term: body.utm_term || null,
  };
  const referrer = body.referrer || "";
  const source = classifySource(referrer, utm);
  const country = "Local";
  const city = null;

  if (!store.visitors[visitorId]) {
    store.visitors[visitorId] = {
      visitor_id: visitorId,
      first_seen: now,
      last_seen: now,
      is_bot: parsed.is_bot,
    };
  } else {
    store.visitors[visitorId].last_seen = now;
    store.visitors[visitorId].is_bot = parsed.is_bot;
  }

  if (!store.sessions[sessionId]) {
    store.sessions[sessionId] = {
      session_id: sessionId,
      visitor_id: visitorId,
      started_at: now,
      last_seen: now,
      landing_page: pathStr,
      exit_page: pathStr,
      referrer_domain: refDomain(referrer),
      source,
      ...utm,
      country,
      city,
      region: null,
      device_type: parsed.device,
      browser: parsed.browser,
      os: parsed.os,
      is_bot: parsed.is_bot,
    };
  } else {
    store.sessions[sessionId].last_seen = now;
    store.sessions[sessionId].exit_page = pathStr;
  }

  store.pageviews.push({
    session_id: sessionId,
    visitor_id: visitorId,
    path: pathStr,
    title: String(body.title || "").slice(0, 255),
    viewed_at: now,
  });
  if (store.pageviews.length > 5000) store.pageviews = store.pageviews.slice(-4000);
  saveStore();
  return { ok: true };
}

function ingestPageview(body) {
  const visitorId = validUuid(body.visitor_id) ? body.visitor_id.toLowerCase() : null;
  const sessionId = validUuid(body.session_id) ? body.session_id.toLowerCase() : null;
  if (!visitorId || !sessionId) return { error: "Invalid ids" };
  const pathStr = sanitizePath(body.path);
  const now = nowIso();
  if (store.sessions[sessionId]) {
    store.sessions[sessionId].last_seen = now;
    store.sessions[sessionId].exit_page = pathStr;
  }
  if (store.visitors[visitorId]) store.visitors[visitorId].last_seen = now;
  store.pageviews.push({
    session_id: sessionId,
    visitor_id: visitorId,
    path: pathStr,
    title: String(body.title || "").slice(0, 255),
    viewed_at: now,
  });
  saveStore();
  return { ok: true };
}

function ingestHeartbeat(body) {
  const visitorId = validUuid(body.visitor_id) ? body.visitor_id.toLowerCase() : null;
  const sessionId = validUuid(body.session_id) ? body.session_id.toLowerCase() : null;
  if (!visitorId || !sessionId) return { error: "Invalid ids" };
  const now = nowIso();
  if (store.sessions[sessionId]) {
    store.sessions[sessionId].last_seen = now;
    if (body.path) store.sessions[sessionId].exit_page = sanitizePath(body.path);
  }
  if (store.visitors[visitorId]) store.visitors[visitorId].last_seen = now;
  saveStore();
  return { ok: true };
}

function humanSessions() {
  return Object.values(store.sessions).filter((s) => !s.is_bot);
}

function summary() {
  const now = Date.now();
  const onlineSince = now - ONLINE_SEC * 1000;
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const week = new Date(startOfDay);
  week.setUTCDate(week.getUTCDate() - 6);
  const month = new Date(Date.UTC(startOfDay.getUTCFullYear(), startOfDay.getUTCMonth(), 1));

  const sessions = humanSessions();
  const uniqSince = (ms) =>
    new Set(sessions.filter((s) => Date.parse(s.started_at) >= ms).map((s) => s.visitor_id)).size;

  const online = new Set(
    sessions.filter((s) => Date.parse(s.last_seen) >= onlineSince).map((s) => s.visitor_id),
  ).size;

  const humanVisitors = Object.values(store.visitors).filter((v) => !v.is_bot).length;
  const pageviews = store.pageviews.filter((pv) => {
    const sess = store.sessions[pv.session_id];
    return sess && !sess.is_bot;
  }).length;

  return {
    online,
    today: uniqSince(startOfDay.getTime()),
    week: uniqSince(week.getTime()),
    week_note: "Rolling last 7 days (including today)",
    month: uniqSince(month.getTime()),
    total_visitors: humanVisitors,
    pageviews,
    active_sessions: sessions.filter((s) => Date.parse(s.last_seen) >= onlineSince).length,
    online_window_sec: ONLINE_SEC,
    server_time: nowIso(),
  };
}

function live() {
  const onlineSince = Date.now() - ONLINE_SEC * 1000;
  const list = humanSessions()
    .filter((s) => Date.parse(s.last_seen) >= onlineSince)
    .sort((a, b) => Date.parse(b.last_seen) - Date.parse(a.last_seen))
    .slice(0, 100)
    .map((s) => {
      const [lat, lon] = approxCoords(s.country, s.city);
      const sessCount = humanSessions().filter((x) => x.visitor_id === s.visitor_id).length;
      return {
        session_id: s.session_id,
        country: s.country || "Unknown",
        city: s.city,
        browser: s.browser,
        os: s.os,
        device: s.device_type,
        source: s.source,
        path: s.exit_page || s.landing_page,
        duration_sec: Math.max(0, Math.floor((Date.parse(s.last_seen) - Date.parse(s.started_at)) / 1000)),
        lat,
        lon,
        returning: sessCount > 1,
      };
    });

  /** @type {Record<string, object>} */
  const clusters = {};
  for (const v of list) {
    const ck = `${v.country}|${v.city || "Unknown"}`;
    if (!clusters[ck]) {
      clusters[ck] = { country: v.country, city: v.city, count: 0, lat: v.lat, lon: v.lon };
    }
    clusters[ck].count++;
  }
  return { visitors: list, map_clusters: Object.values(clusters), online_window_sec: ONLINE_SEC };
}

function traffic() {
  const since = Date.now() - 30 * 86400000;
  const sessions = humanSessions().filter((s) => Date.parse(s.started_at) >= since);
  /** @type {Record<string, { source: string, sessions: number, visitors: Set<string> }>} */
  const bySource = {};
  /** @type {Record<string, number>} */
  const byRef = {};
  /** @type {Record<string, { utm_source: string|null, utm_medium: string|null, utm_campaign: string|null, sessions: number }>} */
  const byUtm = {};
  for (const s of sessions) {
    bySource[s.source] ||= { source: s.source, sessions: 0, visitors: new Set() };
    bySource[s.source].sessions++;
    bySource[s.source].visitors.add(s.visitor_id);
    if (s.referrer_domain) byRef[s.referrer_domain] = (byRef[s.referrer_domain] || 0) + 1;
    if (s.utm_source || s.utm_campaign) {
      const k = `${s.utm_source}|${s.utm_medium}|${s.utm_campaign}`;
      byUtm[k] ||= {
        utm_source: s.utm_source,
        utm_medium: s.utm_medium,
        utm_campaign: s.utm_campaign,
        sessions: 0,
      };
      byUtm[k].sessions++;
    }
  }
  return {
    range: "Last 30 days",
    sources: Object.values(bySource)
      .map((x) => ({ source: x.source, sessions: x.sessions, visitors: x.visitors.size }))
      .sort((a, b) => b.sessions - a.sessions),
    referrers: Object.entries(byRef)
      .map(([domain, sessions]) => ({ domain, sessions }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 20),
    utm: Object.values(byUtm).sort((a, b) => b.sessions - a.sessions).slice(0, 20),
  };
}

function pages() {
  const since = Date.now() - 30 * 86400000;
  /** @type {Record<string, { path: string, views: number, visitors: Set<string> }>} */
  const map = {};
  for (const pv of store.pageviews) {
    if (Date.parse(pv.viewed_at) < since) continue;
    const sess = store.sessions[pv.session_id];
    if (!sess || sess.is_bot) continue;
    map[pv.path] ||= { path: pv.path, views: 0, visitors: new Set() };
    map[pv.path].views++;
    map[pv.path].visitors.add(pv.visitor_id);
  }
  return {
    range: "Last 30 days",
    pages: Object.values(map)
      .map((p) => ({ path: p.path, views: p.views, unique_visitors: p.visitors.size }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 50),
  };
}

function devices() {
  const since = Date.now() - 30 * 86400000;
  const sessions = humanSessions().filter((s) => Date.parse(s.started_at) >= since);
  const group = (key) => {
    /** @type {Record<string, number>} */
    const m = {};
    for (const s of sessions) m[s[key] || "Other"] = (m[s[key] || "Other"] || 0) + 1;
    return Object.entries(m)
      .map(([name, sessions]) => ({ name, sessions }))
      .sort((a, b) => b.sessions - a.sessions);
  };
  return {
    range: "Last 30 days",
    devices: group("device_type"),
    browsers: group("browser"),
    os: group("os"),
  };
}

function timeline() {
  const since = Date.now() - 13 * 86400000;
  /** @type {Record<string, { day: string, visitors: Set<string>, sessions: number }>} */
  const days = {};
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (13 - i));
    const key = d.toISOString().slice(0, 10);
    days[key] = { day: key, visitors: new Set(), sessions: 0 };
  }
  for (const s of humanSessions()) {
    const day = s.started_at.slice(0, 10);
    if (!days[day]) continue;
    if (Date.parse(s.started_at) < since) continue;
    days[day].sessions++;
    days[day].visitors.add(s.visitor_id);
  }
  return {
    range: "Last 14 days",
    visitors: Object.values(days).map((d) => ({
      day: d.day,
      visitors: d.visitors.size,
      sessions: d.sessions,
    })),
    pageviews: [],
  };
}

function json(res, status, body, extraHeaders = {}) {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "http://127.0.0.1:5173",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    ...extraHeaders,
  });
  res.end(raw);
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  /** @type {Record<string, string>} */
  const out = {};
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

function getSession(req) {
  const sid = parseCookies(req).sy_admin_sid;
  if (!sid || !sessions.has(sid)) return null;
  return { sid, ...sessions.get(sid) };
}

function requireAuth(req, res) {
  const s = getSession(req);
  if (!s) {
    json(res, 401, { ok: false, error: "Unauthorized" });
    return null;
  }
  return s;
}

function requireCsrf(req, res, session) {
  const token = req.headers["x-csrf-token"];
  if (!token || token !== session.csrf) {
    json(res, 403, { ok: false, error: "Invalid CSRF token" });
    return false;
  }
  return true;
}

loadStore();

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  if (method === "OPTIONS") {
    json(res, 204, {});
    return;
  }

  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  const pathName = url.pathname.replace(/^\/+/, "");
  const ua = String(req.headers["user-agent"] || "");

  if (pathName === "" || pathName === "health") {
    json(res, 200, {
      ok: true,
      service: "serkan-analytics-dev",
      mode: "real-local-store",
      visitors: Object.keys(store.visitors).length,
      time: nowIso(),
    });
    return;
  }

  if (method === "POST" && pathName === "analytics/visit") {
    const body = await readBody(req);
    const result = ingestVisit(body, ua);
    json(res, 200, { ok: true, ...result });
    return;
  }
  if (method === "POST" && pathName === "analytics/pageview") {
    const body = await readBody(req);
    json(res, 200, { ok: true, ...ingestPageview(body) });
    return;
  }
  if (method === "POST" && pathName === "analytics/heartbeat") {
    const body = await readBody(req);
    json(res, 200, { ok: true, ...ingestHeartbeat(body) });
    return;
  }

  if (method === "GET" && pathName === "auth/status") {
    const s = getSession(req);
    json(res, 200, {
      ok: true,
      authenticated: !!s,
      setup_complete: true,
      csrf_token: s?.csrf ?? null,
      admin: s ? { id: 1, username: s.username, totp_enabled: false } : null,
      db: true,
    });
    return;
  }

  if (method === "POST" && pathName === "auth/login") {
    const body = await readBody(req);
    if (body.username === USER && body.password === PASS) {
      const sid = randomBytes(24).toString("hex");
      const csrf = randomBytes(24).toString("hex");
      sessions.set(sid, { csrf, username: USER, created: Date.now() });
      store.audit.unshift({
        action: "login_success",
        created_at: nowIso().slice(0, 19).replace("T", " "),
        admin_id: 1,
      });
      store.audit = store.audit.slice(0, 50);
      saveStore();
      json(
        res,
        200,
        { ok: true, csrf_token: csrf, admin: { id: 1, username: USER, totp_enabled: false } },
        { "Set-Cookie": `sy_admin_sid=${sid}; Path=/; HttpOnly; SameSite=Strict` },
      );
      return;
    }
    store.audit.unshift({
      action: "login_failed",
      created_at: nowIso().slice(0, 19).replace("T", " "),
      admin_id: null,
    });
    saveStore();
    json(res, 401, { ok: false, error: "Invalid credentials" });
    return;
  }

  if (method === "POST" && pathName === "auth/logout") {
    const s = getSession(req);
    if (s) {
      if (!requireCsrf(req, res, s)) return;
      sessions.delete(s.sid);
    }
    json(res, 200, { ok: true }, {
      "Set-Cookie": "sy_admin_sid=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
    });
    return;
  }

  if (method === "GET" && pathName === "admin/summary") {
    if (!requireAuth(req, res)) return;
    json(res, 200, { ok: true, ...summary() });
    return;
  }
  if (method === "GET" && pathName === "admin/live") {
    if (!requireAuth(req, res)) return;
    json(res, 200, { ok: true, ...live() });
    return;
  }
  if (method === "GET" && pathName === "admin/traffic") {
    if (!requireAuth(req, res)) return;
    json(res, 200, { ok: true, ...traffic() });
    return;
  }
  if (method === "GET" && pathName === "admin/pages") {
    if (!requireAuth(req, res)) return;
    json(res, 200, { ok: true, ...pages() });
    return;
  }
  if (method === "GET" && pathName === "admin/devices") {
    if (!requireAuth(req, res)) return;
    json(res, 200, { ok: true, ...devices() });
    return;
  }
  if (method === "GET" && pathName === "admin/timeline") {
    if (!requireAuth(req, res)) return;
    json(res, 200, { ok: true, ...timeline() });
    return;
  }
  if (method === "GET" && pathName === "admin/audit") {
    if (!requireAuth(req, res)) return;
    json(res, 200, { ok: true, logs: store.audit });
    return;
  }

  json(res, 404, { ok: false, error: "Not found", path: pathName });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[dev-api] http://127.0.0.1:${PORT} (real local store → ${STORE_FILE})`);
  console.log(`[dev-api] login → ${USER} / ${PASS}`);
});
