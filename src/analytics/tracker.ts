const VISITOR_COOKIE = "analytics_vid";
const SESSION_KEY = "analytics_sid";
const HEARTBEAT_MS = 20_000;
const API_BASE = "/api";

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

function setCookie(name: string, value: string, days = 400): void {
  const maxAge = days * 86400;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function getVisitorId(): string {
  let id = getCookie(VISITOR_COOKIE);
  if (!id || !isUuid(id)) {
    id = uuid();
    setCookie(VISITOR_COOKIE, id);
  }
  return id;
}

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id || !isUuid(id)) {
      id = uuid();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return uuid();
  }
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
}

function utmParams(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const q = new URLSearchParams(location.search);
    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
    ]) {
      const v = q.get(key);
      if (v) out[key] = v.slice(0, 160);
    }
  } catch {
    /* ignore */
  }
  return out;
}

async function post(path: string, body: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${API_BASE}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      keepalive: true,
    });
  } catch {
    /* fail-soft */
  }
}

function basePayload(): Record<string, unknown> {
  return {
    visitor_id: getVisitorId(),
    session_id: getSessionId(),
    path: location.pathname || "/",
    title: document.title.slice(0, 255),
    referrer: document.referrer.slice(0, 512),
    screen_width: window.screen?.width,
    screen_height: window.screen?.height,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    ...utmParams(),
  };
}

let started = false;
let heartbeatTimer: number | null = null;

function clearHeartbeat(): void {
  if (heartbeatTimer !== null) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startHeartbeat(): void {
  clearHeartbeat();
  heartbeatTimer = window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    void post("analytics/heartbeat", {
      visitor_id: getVisitorId(),
      session_id: getSessionId(),
      path: location.pathname || "/",
    });
  }, HEARTBEAT_MS);
}

/** Start privacy-friendly analytics. Safe to call once from the public site. */
export function startAnalytics(): void {
  if (started) return;
  if (typeof window === "undefined") return;
  // Skip admin routes
  if (location.pathname.startsWith("/admin")) return;
  started = true;

  void post("analytics/visit", basePayload());
  startHeartbeat();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      startHeartbeat();
      void post("analytics/heartbeat", {
        visitor_id: getVisitorId(),
        session_id: getSessionId(),
        path: location.pathname || "/",
      });
    } else {
      clearHeartbeat();
    }
  });

  window.addEventListener("pagehide", () => {
    void post("analytics/heartbeat", {
      visitor_id: getVisitorId(),
      session_id: getSessionId(),
      path: location.pathname || "/",
    });
  });
}

export function trackPageview(path?: string): void {
  if (!started || location.pathname.startsWith("/admin")) return;
  void post("analytics/pageview", {
    ...basePayload(),
    path: path || location.pathname || "/",
  });
}
