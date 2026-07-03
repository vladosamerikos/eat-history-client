import { useEffect, useState } from 'react';
import { useAuthStore } from './auth.store';
import { fetchMe } from './auth.api';

/** Restaura la identidad desde las cookies HttpOnly sin exponer tokens a JavaScript. */
export function useSessionBootstrap(): { ready: boolean } {
  const setUser = useAuthStore((s) => s.setUser);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await fetchMe();
        if (!cancelled) setUser(user);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  return { ready };
}
