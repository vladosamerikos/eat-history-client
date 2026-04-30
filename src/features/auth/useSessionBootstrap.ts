import { useEffect, useState } from 'react';
import { env } from '@/config/env';
import { useAuthStore } from './auth.store';
import { fetchMe } from './auth.api';

/**
 * En cada arranque intenta restaurar la sesión usando la cookie httpOnly de refresh.
 * Hacemos refresh primero (silencioso) y luego /user/me, evitando un 401 ruidoso en consola.
 */
export function useSessionBootstrap(): { ready: boolean } {
  const setUser = useAuthStore((s) => s.setUser);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const doRefresh = async (): Promise<string | null> => {
        const res = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) return null;
        const { accessToken } = (await res.json()) as { accessToken: string };
        return accessToken;
      };
      try {
        // Cross-tab singleflight: si el navegador soporta Web Locks, serializamos
        // los refresh concurrentes entre pestañas para no disparar reuse-detection.
        const locks = (typeof navigator !== 'undefined' ? navigator.locks : undefined) as
          | LockManager
          | undefined;
        const accessToken = locks && typeof locks.request === 'function'
          ? await locks.request('eh-auth-refresh', () => doRefresh())
          : await doRefresh();
        if (cancelled) return;
        if (accessToken) {
          setAccessToken(accessToken);
          const user = await fetchMe();
          if (!cancelled) setUser(user);
        } else {
          setAccessToken(null);
          setUser(null);
        }
      } catch {
        if (!cancelled) {
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUser, setAccessToken]);

  return { ready };
}
