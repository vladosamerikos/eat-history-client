import { api } from '@/lib/api';

export interface Nutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Food {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  defaultUnit: string;
  defaultPortionG: number;
  nutritionPer100: Nutrition;
  tags: string[];
  imageUrl?: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFoodInput {
  name: string;
  description?: string;
  defaultUnit?: string;
  defaultPortionG?: number;
  nutritionPer100?: Partial<Nutrition>;
  tags?: string[];
}

export const listFoods = (q?: string) =>
  api<Food[]>(`/foods${q ? `?q=${encodeURIComponent(q)}` : ''}`);

export const createFood = (body: CreateFoodInput) =>
  api<Food>('/foods', { method: 'POST', json: body });

export const updateFood = (id: string, body: CreateFoodInput) =>
  api<Food>(`/foods/${id}`, { method: 'PATCH', json: body });

export const deleteFood = (id: string) => api<void>(`/foods/${id}`, { method: 'DELETE' });

export async function uploadFoodPhoto(foodId: string, file: File): Promise<Food> {
  const { env } = await import('@/config/env');
  const { useAuthStore } = await import('@/features/auth/auth.store');
  const token = useAuthStore.getState().accessToken;
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${env.apiBaseUrl}/foods/${encodeURIComponent(foodId)}/photo`, {
    method: 'POST',
    body: fd,
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `Upload failed (${res.status})`);
  }
  return (await res.json()) as Food;
}

export const removeFoodPhoto = (id: string) =>
  api<Food>(`/foods/${id}/photo`, { method: 'DELETE' });
