import { api } from '@/lib/api';

export interface VoiceSession {
  livekitUrl: string;
  room: string;
  token: string;
  identity: string;
  ttlSec: number;
  locale: 'es' | 'en' | 'uk';
}

export function createVoiceSession(locale: 'es' | 'en' | 'uk'): Promise<VoiceSession> {
  return api<VoiceSession>('/voice/session', { method: 'POST', json: { locale } });
}
