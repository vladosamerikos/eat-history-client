import { api } from '@/lib/api';

export interface VoiceSession {
  livekitUrl: string;
  room: string;
  token: string;
  identity: string;
  ttlSec: number;
  locale: 'es' | 'en' | 'uk';
}

export interface CreateVoiceSessionInput {
  locale: 'es' | 'en' | 'uk';
  /** URL de foto a pasar al agente de comidas. */
  photoUrl?: string;
  /** Agente destino: 'meal' (registro) o 'chat' (coach configurable). */
  agent?: 'meal' | 'chat';
  /** Override de modelo LLM (solo agente 'chat'). */
  model?: string;
  /** Motor de TTS / voz (solo agente 'chat'). */
  ttsEngine?: 'chirp3' | 'journey' | 'neural2';
}

export function createVoiceSession(input: CreateVoiceSessionInput): Promise<VoiceSession> {
  const body: Record<string, unknown> = { locale: input.locale };
  if (input.photoUrl) body.photoUrl = input.photoUrl;
  if (input.agent) body.agent = input.agent;
  if (input.model) body.model = input.model;
  if (input.ttsEngine) body.ttsEngine = input.ttsEngine;
  return api<VoiceSession>('/voice/session', { method: 'POST', json: body });
}
