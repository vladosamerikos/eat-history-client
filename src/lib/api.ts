import { env } from '@/config/env';
import { useAuthStore } from '@/features/auth/auth.store';

type Options = RequestInit & { json?: unknown; auth?: boolean };

let refreshPromise: Promise<boolean> | null = null;

// Hace el POST /auth/refresh real. Solo se llama dentro del lock.
async function doRefreshOnce(): Promise<boolean> {
  try {
    const res = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Singleflight local: evita rotaciones duplicadas cuando varias requests reciben
// un 401 simultáneamente. La sesión real permanece únicamente en cookies HttpOnly.
async function attemptRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const locks = (typeof navigator !== 'undefined' ? navigator.locks : undefined) as
        | LockManager
        | undefined;
      if (locks && typeof locks.request === 'function') {
        return await locks.request('fc-auth-refresh', () => doRefreshOnce());
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

async function doFetch(path: string, options: Options): Promise<Response> {
  const { json, headers, auth: _auth, ...rest } = options;
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };
  return fetch(`${env.apiBaseUrl}${path}`, {
    credentials: 'include',
    ...rest,
    headers: finalHeaders,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const request = () => fetch(input, { ...init, credentials: 'include' });
  let res = await request();
  if (res.status === 401 && (await attemptRefresh())) {
    res = await request();
  }
  if (res.status === 401) useAuthStore.getState().clear();
  return res;
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const wantsAuth = options.auth ?? true;
  let res = await doFetch(path, options);

  if (res.status === 401 && wantsAuth) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      res = await doFetch(path, options);
    } else {
      useAuthStore.getState().clear();
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
