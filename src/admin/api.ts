export type ApiResult<T> = { ok: true } & T;

const API = "/api";

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API}/${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & {
    ok?: boolean;
    error?: string;
    need_2fa?: boolean;
  };
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || `HTTP ${res.status}`) as Error & {
      status?: number;
      need_2fa?: boolean;
    };
    err.status = res.status;
    err.need_2fa = data.need_2fa;
    throw err;
  }
  return data;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

export function apiPost<T>(
  path: string,
  body: Record<string, unknown> = {},
  csrf?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (csrf) headers["X-CSRF-Token"] = csrf;
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });
}

export type AuthStatus = {
  ok: boolean;
  authenticated: boolean;
  setup_complete: boolean;
  csrf_token: string | null;
  admin: { id: number; username: string; totp_enabled: boolean } | null;
  db?: boolean;
};
