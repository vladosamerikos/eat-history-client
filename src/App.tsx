import { AppRouter } from '@/router';
import { useSessionBootstrap } from '@/features/auth/useSessionBootstrap';
import { CookieBanner } from '@/components/CookieBanner';

export default function App() {
  const { ready } = useSessionBootstrap();
  if (!ready) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <div
          aria-label="loading"
          className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary"
        />
      </main>
    );
  }
  return (
    <>
      <AppRouter />
      <CookieBanner />
    </>
  );
}
