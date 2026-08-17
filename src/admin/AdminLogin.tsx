import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { apiGet, apiPost, type AuthStatus } from "./api";
import "./admin.css";

export function AdminLogin() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [need2fa, setNeed2fa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [setupMode, setSetupMode] = useState(false);

  useEffect(() => {
    void apiGet<AuthStatus>("auth/status")
      .then((s) => {
        setStatus(s);
        if (!s.setup_complete) setSetupMode(true);
      })
      .catch(() =>
        setStatus({
          ok: true,
          authenticated: false,
          setup_complete: true,
          csrf_token: null,
          admin: null,
          db: false,
        }),
      );
  }, []);

  if (status?.authenticated) {
    return <Navigate to="/admin/analytics" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (setupMode && status && !status.setup_complete) {
        await apiPost("auth/setup", { username, password });
      } else {
        await apiPost("auth/login", {
          username,
          password,
          totp: totp || undefined,
        });
      }
      navigate("/admin/analytics", { replace: true });
    } catch (err) {
      const e2 = err as Error & { need_2fa?: boolean; status?: number };
      if (e2.need_2fa) {
        setNeed2fa(true);
        setError("İki adımlı doğrulama kodu gerekli.");
      } else if (e2.status === 502 || /502|Failed to fetch|NetworkError/i.test(e2.message)) {
        setError(
          "API'ye ulaşılamıyor (502). Lokal test için ayrı terminalde: npm run dev:api",
        );
      } else {
        setError(e2.message || "Giriş başarısız");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-root admin-login">
      <div className="admin-login__panel">
        <p className="admin-eyebrow">SERKAN.YILMAZ // ADMIN</p>
        <h1>{setupMode ? "İlk admin kurulumu" : "Giriş"}</h1>
        <p className="admin-login__hint">
          {setupMode
            ? "ALLOW_SETUP=true iken tek seferlik hesap oluşturma."
            : "Yetkili erişim. Oturumlar süre sınırlıdır."}
        </p>
        <form onSubmit={onSubmit} className="admin-form">
          <label>
            Kullanıcı adı
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
            />
          </label>
          <label>
            Parola
            <input
              type="password"
              autoComplete={setupMode ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={setupMode ? 12 : 1}
            />
          </label>
          {need2fa && (
            <label>
              2FA kodu
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                placeholder="123456"
              />
            </label>
          )}
          {error && <p className="admin-error">{error}</p>}
          <button type="submit" disabled={loading} className="admin-btn">
            {loading ? "…" : setupMode ? "Kur ve giriş yap" : "Giriş yap"}
          </button>
        </form>
      </div>
    </div>
  );
}
