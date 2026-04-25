import { api } from '@/lib/api';
import type { PublicUser } from '@/features/auth/auth.store';

export interface UpdateSettingsInput {
  remindersEnabled?: boolean;
  reminderTimes?: Partial<{ breakfast: string; lunch: string; snack: string; dinner: string }>;
  reminderTimezone?: string;
  locale?: string;
}

export async function updateSettings(input: UpdateSettingsInput): Promise<PublicUser> {
  return api('/user/settings', { method: 'PATCH', json: input });
}
