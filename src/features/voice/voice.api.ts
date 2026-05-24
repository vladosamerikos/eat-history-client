import { api } from '@/lib/api';

export interface VoiceSession {
  livekitUrl: string;
  room: string;
  token: string;
  identity: string;
  ttlSec: number;
  locale: 'es' | 'en' | 'uk';
}

export function createVoiceSession(
  locale: 'es' | 'en' | 'uk',
  photoUrl?: string,
): Promise<VoiceSession> {
  return api<VoiceSession>('/voice/session', {
    method: 'POST',
    json: photoUrl ? { locale, photoUrl } : { locale },
  });
}
