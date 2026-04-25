import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from './auth.store';

export function ProtectedRoute({
  children,
  requireOnboarding,
}: {
  children: ReactNode;
  requireOnboarding?: boolean;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  if (!accessToken) return <Navigate to="/login" replace />;
  if (requireOnboarding && user && !user.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}
