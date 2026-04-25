import { env } from '@/config/env';
import { useAuthStore } from '@/features/auth/auth.store';

type Options = RequestInit & { json?: unknown; auth?: boolean };

let refreshPromise: Promise<string | null> | null = null;

async function attemptRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
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
