const raw = import.meta.env.VITE_API_URL as string | undefined;
export const API_BASE = (raw && raw.length > 0 ? raw : "").replace(/\/$/, "");

function tokenKey() {
  return "fintrack_token";
}

export function getToken(): string | null {
  return localStorage.getItem(tokenKey());
}

export function setToken(t: string | null) {
  if (t) localStorage.setItem(tokenKey(), t);
  else localStorage.removeItem(tokenKey());
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const tok = getToken();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  if (tok) headers.set("Authorization", `Bearer ${tok}`);

  const res = await fetch(url, { ...init, headers });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!res.ok) {
    const msg =
      typeof body === "object" && body && "error" in body
        ? String((body as { error?: { message?: string } }).error?.message ?? res.statusText)
        : res.statusText;
    throw new Error(msg);
  }
  return body as T;
}
