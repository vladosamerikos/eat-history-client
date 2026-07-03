import { api, authenticatedFetch } from '@/lib/api';
import type { PublicUser, UnitPreferences } from '@/features/auth/auth.store';
import { env } from '@/config/env';

export interface UpdateProfileInput {
  name?: string;
}

export const updateProfile = (body: UpdateProfileInput): Promise<PublicUser> =>
  api('/user/profile', { method: 'PATCH', json: body });

export const updateUnits = (body: Partial<UnitPreferences>): Promise<PublicUser> =>
  api('/user/units', { method: 'PATCH', json: body });

export async function uploadAvatar(file: File): Promise<PublicUser> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await authenticatedFetch(`${env.apiBaseUrl}/user/avatar`, {
    method: 'POST',
    body: fd,
    credentials: 'include',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `Upload failed (${res.status})`);
  }
  return (await res.json()) as PublicUser;
}

export const removeAvatar = (): Promise<PublicUser> => api('/user/avatar', { method: 'DELETE' });

export interface SessionInfo {
  id: string;
  userAgent?: string;
  ip?: string;
  createdAt: string;
  expiresAt: string;
}

export const listSessions = (): Promise<SessionInfo[]> => api('/auth/sessions');
export const revokeSession = (id: string): Promise<void> =>
  api(`/auth/sessions/${id}`, { method: 'DELETE' });
