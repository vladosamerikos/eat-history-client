import { api } from '@/lib/api';
import type { PublicUser } from '@/features/auth/auth.store';

export type OnboardingStep = 'locale' | 'name' | 'goal' | 'preferences' | 'done';

export interface OnboardingProgress {
  step: OnboardingStep;
  completed: boolean;
  state: Record<string, unknown>;
}

export async function fetchOnboardingProgress(): Promise<OnboardingProgress> {
  return api<OnboardingProgress>('/onboarding/progress');
}

export interface PatchPayload {
  step: OnboardingStep;
  locale?: string;
  name?: string;
  goal?: string;
  preferences?: Record<string, unknown>;
}

export async function patchOnboarding(body: PatchPayload): Promise<{
  user: PublicUser;
  progress: OnboardingProgress;
}> {
  return api('/onboarding/progress', { method: 'PATCH', json: body });
}
