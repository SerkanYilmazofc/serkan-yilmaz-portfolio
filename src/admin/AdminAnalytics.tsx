import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { apiGet, apiPost, type AuthStatus } from "./api";
import "./admin.css";

type Summary = {
  online: number;
  today: number;
  week: number;
  week_note: string;
  month: number;
  total_visitors: number;
  pageviews: number;
  active_sessions: number;
  online_window_sec: number;
};

type LiveVisitor = {
  session_id: string;
  country: string;
  city: string | null;
  browser: string;
  os: string;
  device: string;
  source: string;
  path: string;
  duration_sec: number;
  lat: number | null;
  lon: number | null;
  returning: boolean;
};

type MapCluster = {
  country: string;
  city: string | null;
  count: number;
  lat: number | null;
  lon: number | null;
};

function project(lat: number, lon: number, w: number, h: number) {
  const x = ((lon + 180) / 360) * w;
  const y = ((90 - lat) / 180) * h;
  return { x, y };
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec} sn`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m} dk ${s} sn`;
}

export function AdminAnalytics() {
  const navigate = useNavigate();
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [live, setLive] = useState<LiveVisitor[]>([]);
  const [clusters, setClusters] = useState<MapCluster[]>([]);
  const [traffic, setTraffic] = useState<{
    sources: { source: string; sessions: number; visitors: number }[];
    referrers: { domain: string; sessions: number }[];
    utm: {
      utm_source: string | null;
      utm_medium: string | null;
      utm_campaign: string | null;
      sessions: number;
    }[];
  } | null>(null);
  const [pages, setPages] = useState<
    { path: string; views: number; unique_visitors: number }[]
  >([]);
  const [devices, setDevices] = useState<{
    devices: { name: string; sessions: number }[];
    browsers: { name: string; sessions: number }[];
    os: { name: string; sessions: number }[];
  } | null>(null);
  const [timeline, setTimeline] = useState<
    { day: string; visitors: number; sessions: number }[]
  >([]);
  const [audit, setAudit] = useState<
    { action: string; created_at: string; admin_id: number | null }[]
  >([]);
  const [liveOk, setLiveOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAuth = useCallback(async () => {
    const s = await apiGet<AuthStatus>("auth/status");
    setAuth(s);
    return s;
  }, []);

  const refreshLive = useCallback(async () => {
    try {
      const [sum, liveRes] = await Promise.all([
        apiGet<{ ok: boolean } & Summary>("admin/summary"),
        apiGet<{
          ok: boolean;
          visitors: LiveVisitor[];
          map_clusters: MapCluster[];
        }>("admin/live"),
      ]);
      setSummary(sum);
      setLive(liveRes.visitors);
      setClusters(liveRes.map_clusters);
      setLiveOk(true);
      setError(null);
    } catch (e) {
      setLiveOk(false);
      const err = e as Error & { status?: number };
      if (err.status === 401) {
        navigate("/admin/login", { replace: true });
      } else {
        setError(err.message);
      }
    }
  }, [navigate]);

  const refreshSlow = useCallback(async () => {
    try {
      const [t, p, d, tl, a] = await Promise.all([
        apiGet<{
          ok: boolean;
          sources: { source: string; sessions: number; visitors: number }[];
          referrers: { domain: string; sessions: number }[];
          utm: {
            utm_source: string | null;
            utm_medium: string | null;
            utm_campaign: string | null;
            sessions: number;
          }[];
        }>("admin/traffic"),
        apiGet<{
          ok: boolean;
          pages: { path: string; views: number; unique_visitors: number }[];
        }>("admin/pages"),
        apiGet<{
          ok: boolean;
          devices: { name: string; sessions: number }[];
          browsers: { name: string; sessions: number }[];
          os: { name: string; sessions: number }[];
        }>("admin/devices"),
        apiGet<{
          ok: boolean;
          visitors: { day: string; visitors: number; sessions: number }[];
        }>("admin/timeline"),
        apiGet<{
          ok: boolean;
          logs: {
            action: string;
            created_at: string;
            admin_id: number | null;
          }[];
        }>("admin/audit"),
      ]);
      setTraffic({ sources: t.sources, referrers: t.referrers, utm: t.utm });
      setPages(p.pages);
      setDevices({ devices: d.devices, browsers: d.browsers, os: d.os });
      setTimeline(tl.visitors);
      setAudit(a.logs);
    } catch {
      /* ignore slow panel errors while live may still work */
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const s = await refreshAuth();
        if (!s.authenticated) {
          navigate("/admin/login", { replace: true });
          return;
        }
        await refreshLive();
        await refreshSlow();
      } catch {
        navigate("/admin/login", { replace: true });
      }
    })();
  }, [navigate, refreshAuth, refreshLive, refreshSlow]);

  useEffect(() => {
    if (!auth?.authenticated) return;
    const liveTimer = window.setInterval(() => void refreshLive(), 8_000);
    const slowTimer = window.setInterval(() => void refreshSlow(), 60_000);
    return () => {
      window.clearInterval(liveTimer);
      window.clearInterval(slowTimer);
    };
  }, [auth?.authenticated, refreshLive, refreshSlow]);

  async function logout() {
    try {
      await apiPost("auth/logout", {}, auth?.csrf_token);
    } catch {
      /* ignore */
    }
    navigate("/admin/login", { replace: true });
  }

  if (auth && !auth.authenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  const mapW = 640;
  const mapH = 320;
  const maxTimeline = Math.max(1, ...timeline.map((t) => t.visitors));

  return (
    <div className="admin-root admin-dash">
      <header className="admin-top">
        <div>
          <p className="admin-eyebrow">SERKAN.YILMAZ // ANALYTICS</p>
          <h1>Panel</h1>
        </div>
        <div className="admin-top__right">
          <span className={`admin-live-pill ${liveOk ? "is-live" : ""}`}>
            <span className="admin-live-dot" /> LIVE
          </span>
          <span className="admin-user">{auth?.admin?.username}</span>
          <button type="button" className="admin-btn ghost" onClick={logout}>
            Çıkış
          </button>
        </div>
      </header>

      {error && <p className="admin-error banner">{error}</p>}

      <section className="admin-metrics">
        {[
          { label: "Şu an online", value: summary?.online ?? "—" },
          { label: "Bugün", value: summary?.today ?? "—" },
          { label: "Bu hafta", value: summary?.week ?? "—", note: summary?.week_note },
          { label: "Bu ay", value: summary?.month ?? "—" },
          { label: "Toplam ziyaretçi", value: summary?.total_visitors ?? "—" },
          { label: "Sayfa görüntüleme", value: summary?.pageviews ?? "—" },
        ].map((m) => (
          <div key={m.label} className="admin-metric">
            <span className="admin-metric__label">{m.label}</span>
            <span className="admin-metric__value">{m.value}</span>
            {"note" in m && m.note ? (
              <span className="admin-metric__note">{m.note}</span>
            ) : null}
          </div>
        ))}
      </section>

      <div className="admin-grid">
        <section className="admin-panel admin-map">
          <h2>Canlı harita</h2>
          <p className="admin-panel__sub">Yaklaşık konum · küme</p>
          <svg
            className="admin-map__svg"
            viewBox={`0 0 ${mapW} ${mapH}`}
            role="img"
            aria-label="Live visitor map"
          >
            <rect width={mapW} height={mapH} fill="#0e0e0e" />
            <path
              d="M40 80 Q160 40 280 90 T520 70 T600 120 L600 260 Q400 300 200 270 Q80 240 40 200 Z"
              fill="#1c1b1b"
              stroke="#2b2a2a"
            />
            {clusters.map((c, i) => {
              if (c.lat == null || c.lon == null) return null;
              const { x, y } = project(c.lat, c.lon, mapW, mapH);
              const r = 4 + Math.min(14, c.count * 2);
              return (
                <g key={`${c.country}-${c.city}-${i}`}>
                  <circle cx={x} cy={y} r={r} fill="rgba(59,130,246,0.35)" />
                  <circle cx={x} cy={y} r={3} fill="#3b82f6" />
                  <title>
                    {c.country}
                    {c.city ? ` / ${c.city}` : ""} — {c.count}
                  </title>
                </g>
              );
            })}
          </svg>
          {clusters.length === 0 && (
            <p className="admin-empty">Şu an haritada aktif küme yok.</p>
          )}
        </section>

        <section className="admin-panel">
          <h2>Canlı akış</h2>
          <p className="admin-panel__sub">
            Online penceresi ~{summary?.online_window_sec ?? 60} sn
          </p>
          <ul className="admin-stream">
            {live.length === 0 && (
              <li className="admin-empty">Aktif ziyaretçi yok.</li>
            )}
            {live.map((v) => (
              <li key={v.session_id}>
                <span className="admin-stream__dot" />
                <span>
                  {v.country}
                  {v.city ? ` / ${v.city}` : ""} — {v.browser} / {v.os} —{" "}
                  {v.path} — {formatDuration(v.duration_sec)}
                  <small>
                    {" "}
                    · {v.device} · {v.source}
                    {v.returning ? " · dönen" : " · yeni"}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="admin-panel">
        <h2>Son 14 gün</h2>
        <div className="admin-bars">
          {timeline.map((t) => (
            <div key={t.day} className="admin-bar" title={`${t.day}: ${t.visitors}`}>
              <div
                className="admin-bar__fill"
                style={{ height: `${(t.visitors / maxTimeline) * 100}%` }}
              />
              <span>{t.day.slice(5)}</span>
            </div>
          ))}
          {timeline.length === 0 && <p className="admin-empty">Henüz veri yok.</p>}
        </div>
      </section>

      <div className="admin-grid">
        <section className="admin-panel">
          <h2>Trafik kaynakları</h2>
          <p className="admin-panel__sub">Son 30 gün</p>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Kaynak</th>
                <th>Oturum</th>
                <th>Ziyaretçi</th>
              </tr>
            </thead>
            <tbody>
              {(traffic?.sources || []).map((s) => (
                <tr key={s.source}>
                  <td>{s.source}</td>
                  <td>{s.sessions}</td>
                  <td>{s.visitors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="admin-panel">
          <h2>Sayfalar</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Path</th>
                <th>Görüntüleme</th>
                <th>Tekil</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.path}>
                  <td>{p.path}</td>
                  <td>{p.views}</td>
                  <td>{p.unique_visitors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <div className="admin-grid">
        <section className="admin-panel">
          <h2>Cihaz / tarayıcı / OS</h2>
          <div className="admin-split3">
            <ListBlock title="Cihaz" rows={devices?.devices || []} />
            <ListBlock title="Tarayıcı" rows={devices?.browsers || []} />
            <ListBlock title="OS" rows={devices?.os || []} />
          </div>
        </section>

        <section className="admin-panel">
          <h2>Referrer / UTM</h2>
          <h3 className="admin-h3">Referrer</h3>
          <ul className="admin-list">
            {(traffic?.referrers || []).map((r) => (
              <li key={r.domain}>
                {r.domain} <em>{r.sessions}</em>
              </li>
            ))}
          </ul>
          <h3 className="admin-h3">UTM</h3>
          <ul className="admin-list">
            {(traffic?.utm || []).map((u, i) => (
              <li key={i}>
                {[u.utm_source, u.utm_medium, u.utm_campaign]
                  .filter(Boolean)
                  .join(" / ") || "—"}{" "}
                <em>{u.sessions}</em>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="admin-panel">
        <h2>Audit log</h2>
        <ul className="admin-list">
          {audit.map((a, i) => (
            <li key={i}>
              <code>{a.action}</code> — {a.created_at} UTC
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ListBlock({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; sessions: number }[];
}) {
  return (
    <div>
      <h3 className="admin-h3">{title}</h3>
      <ul className="admin-list">
        {rows.map((r) => (
          <li key={r.name || "x"}>
            {r.name || "—"} <em>{r.sessions}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
