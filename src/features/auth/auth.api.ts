import { api } from '@/lib/api';
import type { PublicUser } from './auth.store';

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
}

export async function registerUser(input: {
  email: string;
  password: string;
  name?: string;
  locale?: string;
  acceptedTerms: boolean;
}): Promise<AuthResponse> {
  return api<AuthResponse>('/auth/register', { method: 'POST', json: input, auth: false });
}

export async function loginUser(input: { email: string; password: string }): Promise<AuthResponse> {
  return api<AuthResponse>('/auth/login', { method: 'POST', json: input, auth: false });
}

export async function logoutUser(): Promise<void> {
  await api<void>('/auth/logout', { method: 'POST', auth: false });
}

export async function fetchMe(): Promise<PublicUser> {
  return api<PublicUser>('/user/me', { method: 'GET' });
}

export async function startGuest(): Promise<{
  guestToken: string;
  locale: string;
  onboardingStep: string;
  onboardingState: Record<string, unknown>;
}> {
  return api('/guest/start', { method: 'POST', auth: false });
}

export async function forgotPassword(email: string): Promise<{ ok: true }> {
  return api('/auth/forgot-password', { method: 'POST', json: { email }, auth: false });
}

export async function resetPassword(token: string, password: string): Promise<{ ok: true }> {
  return api('/auth/reset-password', { method: 'POST', json: { token, password }, auth: false });
}

export async function verifyEmail(token: string): Promise<{ ok: true; user: PublicUser }> {
  return api('/auth/verify-email', { method: 'POST', json: { token }, auth: false });
}

export async function resendVerifyEmail(email: string): Promise<{ ok: true }> {
  return api('/auth/resend-verify', { method: 'POST', json: { email }, auth: false });
}

export async function deleteAccount(): Promise<void> {
  await api<void>('/auth/account', { method: 'DELETE' });
}
