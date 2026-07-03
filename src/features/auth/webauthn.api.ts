import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { api } from '@/lib/api';
import type { PublicUser } from '@/features/auth/auth.store';

export async function registerPasskey(deviceName?: string): Promise<{ verified: boolean }> {
  const options = await api<unknown>('/auth/webauthn/register/options', { method: 'POST' });
  // tipos opcionales del browser:
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attResp = await startRegistration({ optionsJSON: options as any });
  return api<{ verified: boolean }>('/auth/webauthn/register/verify', {
    method: 'POST',
    json: { response: attResp, deviceName, email: '' },
    auth: true,
  });
}

export async function loginWithPasskey(email?: string): Promise<{
  user: PublicUser;
}> {
  const { options, handle } = await api<{ options: unknown; handle: string }>(
    '/auth/webauthn/login/options',
    { method: 'POST', json: { email }, auth: false },
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assertion = await startAuthentication({ optionsJSON: options as any });
  return api<{ user: PublicUser }>('/auth/webauthn/login/verify', {
    method: 'POST',
    json: { handle, response: assertion },
    auth: false,
  });
}

export function startGoogleLogin(apiBaseUrl: string): void {
  // Usamos siempre URL relativa-ish: si apiBaseUrl es `/v1` Vite proxy lo redirige al API,
  // y en producción nginx hace lo propio. Si es absoluta (legacy) también funciona.
  window.location.href = `${apiBaseUrl}/auth/google`;
}

export interface PasskeyInfo {
  id: string;
  deviceName?: string;
  createdAt: string;
  lastUsedAt?: string;
}

export async function listPasskeys(): Promise<PasskeyInfo[]> {
  return api<PasskeyInfo[]>('/auth/webauthn/credentials', { method: 'GET' });
}

export async function deletePasskey(id: string): Promise<void> {
  await api<void>(`/auth/webauthn/credentials/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
