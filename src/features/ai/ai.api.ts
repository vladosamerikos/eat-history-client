import { api, authenticatedFetch } from '@/lib/api';
import { env } from '@/config/env';

export type AiTier = 'free' | 'preview' | 'paid' | 'limited';
export type AiCapability = 'vision' | 'text' | 'json';
export type AiProvider = 'openai' | 'google';

export interface AiModelDto {
  id: string;
  provider: AiProvider;
  modelId: string;
  displayName: string;
  description?: string;
  capabilities: AiCapability[];
  tier: AiTier;
  contextWindow?: number;
}

export interface AiAdminModelDto extends AiModelDto {
  isActive: boolean;
  order: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EstimateResult {
  name?: string;
  weightG?: number;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  confidence?: number;
  notes?: string;
  modelUsed?: string;
  provider?: string;
}

export interface AnalyzeMealItem {
  name: string;
  weightG: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidence?: number;
}

export interface AnalyzeMealResult {
  items: AnalyzeMealItem[];
  totalKcal: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  confidence?: number;
  notes?: string;
  modelUsed?: string;
  provider?: string;
}

export const listAiModels = () => api<AiModelDto[]>(`/ai/models`);

export const updateAiPreference = (body: { vision?: string | null; text?: string | null }) =>
  api(`/ai/preference`, { method: 'PATCH', json: body });

/**
 * Llama al endpoint de estimación. Acepta cualquier combinación entre imagen,
 * nombre y peso (al menos uno entre imagen o nombre debe estar presente).
 */
export async function estimateNutrition(input: {
  image?: File;
  name?: string;
  weightG?: number;
  locale?: string;
}): Promise<EstimateResult> {
  const fd = new FormData();
  if (input.image) fd.append('file', input.image);
  if (input.name) fd.append('name', input.name);
  if (input.weightG != null) fd.append('weightG', String(input.weightG));
  if (input.locale) fd.append('locale', input.locale);
  const res = await authenticatedFetch(`${env.apiBaseUrl}/ai/estimate`, {
    method: 'POST',
    body: fd,
    credentials: 'include',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`AI estimate failed (${res.status}): ${txt}`);
  }
  return (await res.json()) as EstimateResult;
}

/**
 * Analiza una foto de plato y devuelve TODOS los items detectados con macros.
 * Pensado para autocompletar el formulario con varios entries de una sola vez.
 */
export async function analyzeMealPhoto(input: {
  image: File;
  locale?: string;
  hint?: string;
}): Promise<AnalyzeMealResult> {
  const fd = new FormData();
  fd.append('file', input.image);
  if (input.locale) fd.append('locale', input.locale);
  if (input.hint) fd.append('hint', input.hint);
  const res = await authenticatedFetch(`${env.apiBaseUrl}/ai/analyze-meal-photo`, {
    method: 'POST',
    body: fd,
    credentials: 'include',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`AI analyze-meal-photo failed (${res.status}): ${txt}`);
  }
  return (await res.json()) as AnalyzeMealResult;
}

// ---- STT (dictado de voz) ----

/**
 * Transcribe un clip de audio a texto vía backend (Gemini). Pensado para el
 * dictado de mensajes en el chat.
 */
export async function transcribeAudio(input: {
  blob: Blob;
  locale?: string;
}): Promise<{ text: string; modelUsed: string }> {
  const fd = new FormData();
  const ext = input.blob.type.includes('ogg')
    ? 'ogg'
    : input.blob.type.includes('mp4') || input.blob.type.includes('m4a')
      ? 'm4a'
      : 'webm';
  fd.append('file', input.blob, `dictation.${ext}`);
  if (input.locale) fd.append('locale', input.locale);
  const res = await authenticatedFetch(`${env.apiBaseUrl}/ai/transcribe`, {
    method: 'POST',
    body: fd,
    credentials: 'include',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`AI transcribe failed (${res.status}): ${txt}`);
  }
  return (await res.json()) as { text: string; modelUsed: string };
}

// ---- Admin ----
export const adminListAiModels = (params: { provider?: AiProvider; q?: string } = {}) => {
  const sp = new URLSearchParams();
  if (params.provider) sp.set('provider', params.provider);
  if (params.q) sp.set('q', params.q);
  const qs = sp.toString();
  return api<AiAdminModelDto[]>(`/admin/ai/models${qs ? `?${qs}` : ''}`);
};

export const adminCreateAiModel = (body: Partial<AiAdminModelDto>) =>
  api<{ id: string }>(`/admin/ai/models`, { method: 'POST', json: body });

export const adminUpdateAiModel = (id: string, body: Partial<AiAdminModelDto>) =>
  api<{ id: string }>(`/admin/ai/models/${id}`, { method: 'PATCH', json: body });

export const adminDeleteAiModel = (id: string) =>
  api<{ ok: boolean }>(`/admin/ai/models/${id}`, { method: 'DELETE' });

export const adminVerifyAiModel = (id: string) =>
  api<{ ok: boolean; message?: string }>(`/admin/ai/models/${id}/verify`, { method: 'POST' });
