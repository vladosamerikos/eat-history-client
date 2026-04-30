import { api } from '@/lib/api';

export interface Weight {
  _id: string;
  userId: string;
  date: string;
  time?: string;
  kg: number;
  bodyFat?: number;
  muscle?: number;
  water?: number;
  bone?: number;
  visceralFat?: number;
  bmr?: number;
  notes: string;
  source: string;
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWeightInput {
  date: string;
  time?: string;
  kg: number;
  bodyFat?: number;
  muscle?: number;
  water?: number;
  bone?: number;
  visceralFat?: number;
  bmr?: number;
  notes?: string;
  source?: 'manual' | 'scale-photo' | 'ble-mi-scale';
  photoUrl?: string;
}

export const listWeights = (opts: { from?: string; to?: string; limit?: number } = {}) => {
  const qs = new URLSearchParams();
  if (opts.from) qs.set('from', opts.from);
  if (opts.to) qs.set('to', opts.to);
  if (opts.limit) qs.set('limit', String(opts.limit));
  const s = qs.toString();
  return api<Weight[]>(`/weights${s ? `?${s}` : ''}`);
};

export const latestWeight = () => api<Weight | null>('/weights/latest');

export const createWeight = (body: CreateWeightInput) =>
  api<Weight>('/weights', { method: 'POST', json: body });

export const updateWeight = (id: string, body: Partial<CreateWeightInput>) =>
  api<Weight>(`/weights/${id}`, { method: 'PATCH', json: body });

export const deleteWeight = (id: string) =>
  api<void>(`/weights/${id}`, { method: 'DELETE' });

export async function uploadWeightPhoto(weightId: string, file: File): Promise<Weight> {
  const { env } = await import('@/config/env');
  const { useAuthStore } = await import('@/features/auth/auth.store');
  const token = useAuthStore.getState().accessToken;
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(
    `${env.apiBaseUrl}/weights/${encodeURIComponent(weightId)}/photo`,
    {
      method: 'POST',
      body: fd,
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `Upload failed (${res.status})`);
  }
  return (await res.json()) as Weight;
}

export const removeWeightPhoto = (id: string) =>
  api<Weight>(`/weights/${id}/photo`, { method: 'DELETE' });
