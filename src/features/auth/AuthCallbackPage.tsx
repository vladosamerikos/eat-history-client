import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from './auth.store';
import { fetchMe } from './auth.api';

/** Completa Google OAuth leyendo la sesión HttpOnly ya creada por el backend. */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    fetchMe()
      .then((u) => {
        setUser(u);
        navigate('/app', { replace: true });
      })
      .catch(() => navigate('/login?error=oauth', { replace: true }));
  }, [navigate, setUser]);

  return (
    <main className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
      Signing you in…
    </main>
  );
}
