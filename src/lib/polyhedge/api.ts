// Browser-side fetch wrapper for the poly-hedge FastAPI.
// Behind the nfl-router nginx (projects.blainecowen.com and :3001) the API is
// proxied same-origin at /polyhedge-api, behind the owner sign-in, so it works
// from the phone over https. The dev preview on :3002 has no proxy and talks
// to the API on the LAN directly. NEXT_PUBLIC_POLYHEDGE_API_BASE overrides both.

function apiBase(): string {
  const env = process.env.NEXT_PUBLIC_POLYHEDGE_API_BASE;
  if (env) return env.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.port === "3002") {
    return "http://server:8587";
  }
  return "/polyhedge-api";
}

const API_BASE = apiBase();

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & {
    searchParams?: Record<string, string | number | undefined>;
  },
): Promise<T> {
  const { searchParams, ...rest } = init ?? {};
  let url = `${API_BASE}${path}`;
  if (searchParams) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }
  const res = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(rest.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(
    path: string,
    searchParams?: Record<string, string | number | undefined>,
  ) => request<T>(path, { method: "GET", searchParams }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
};

export { ApiError, API_BASE };
