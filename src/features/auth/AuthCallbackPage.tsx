import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from './auth.store';
import { fetchMe } from './auth.api';

/** Recibe `#access_token=…` desde Google OAuth callback. */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    if (!token) {
      navigate('/login?error=oauth', { replace: true });
      return;
    }
    setAccessToken(token);
    fetchMe()
      .then((u) => {
        setUser(u);
        navigate('/app', { replace: true });
      })
      .catch(() => navigate('/login?error=oauth', { replace: true }));
  }, [navigate, setAccessToken, setUser]);

  return (
    <main className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
      Signing you in…
    </main>
  );
}
