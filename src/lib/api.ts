import { env } from '@/config/env';
import { useAuthStore } from '@/features/auth/auth.store';

type Options = RequestInit & { json?: unknown; auth?: boolean };

let refreshPromise: Promise<string | null> | null = null;

// Hace el POST /auth/refresh real. Solo se llama dentro del lock.
async function doRefreshOnce(): Promise<string | null> {
  try {
    const res = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string };
    useAuthStore.getState().setAccessToken(data.accessToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

// Cross-tab singleflight: si el navegador soporta Web Locks API, serializamos
// el refresh entre pestañas. Si dentro del lock detectamos que ya hay un
// access token reciente (otra pestaña terminó antes), lo reutilizamos sin
// volver a llamar al backend (evita el race que disparaba "reuse detected").
async function attemptRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const tokenBefore = useAuthStore.getState().accessToken;
  refreshPromise = (async () => {
    try {
      const locks = (typeof navigator !== 'undefined' ? navigator.locks : undefined) as
        | LockManager
        | undefined;
      if (locks && typeof locks.request === 'function') {
        return await locks.request('eh-auth-refresh', async () => {
          const current = useAuthStore.getState().accessToken;
          if (current && current !== tokenBefore) return current;
          return doRefreshOnce();
        });
      }
      return await doRefreshOnce();
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export class ApiError extends Error {
  status: number;

  payload: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function doFetch(path: string, options: Options, token: string | null): Promise<Response> {
  const { json, headers, auth: _auth, ...rest } = options;
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  return fetch(`${env.apiBaseUrl}${path}`, {
    credentials: 'include',
    ...rest,
    headers: finalHeaders,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const wantsAuth = options.auth ?? true;
  const token = wantsAuth ? useAuthStore.getState().accessToken : null;
  let res = await doFetch(path, options, token);

  if (res.status === 401 && wantsAuth) {
    const newToken = await attemptRefresh();
    if (newToken) {
      res = await doFetch(path, options, newToken);
    }
  }

  if (!res.ok) {
    let payload: unknown;
    const text = await res.text().catch(() => '');
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }
    const message =
      (payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : null) ?? `${res.status} ${res.statusText}`;
    throw new ApiError(res.status, message, payload);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
