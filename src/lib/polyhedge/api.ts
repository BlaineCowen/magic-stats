// Browser-side fetch wrapper for the poly-hedge FastAPI.
// CORS on api_server.py is wide open, so this hits the host directly.
// Override at deploy time via NEXT_PUBLIC_POLYHEDGE_API_BASE if you ever
// proxy through a different hostname.

const API_BASE = (
  process.env.NEXT_PUBLIC_POLYHEDGE_API_BASE ?? "http://server:8587"
).replace(/\/$/, "");

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
