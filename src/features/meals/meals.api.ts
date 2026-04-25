import { api } from '@/lib/api';

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export interface MealEntry {
  foodId?: string;
  customName?: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Meal {
  _id: string;
  userId: string;
  date: string;
  type: MealType;
  entries: MealEntry[];
  totalKcal: number;
  notes: string;
  source: string;
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailySummary {
  date: string;
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  byType: Record<MealType, number>;
  mealsCount: number;
}

export interface CreateMealInput {
  date: string;
  type: MealType;
  entries: Array<Partial<MealEntry>>;
  notes?: string;
  source?: string;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const listMeals = (date?: string) =>
  api<Meal[]>(`/meals${date ? `?date=${date}` : ''}`);

export const dailySummary = (date?: string) =>
  api<DailySummary>(`/meals/summary${date ? `?date=${date}` : ''}`);

export const weeklySummary = (from?: string, days = 7) =>
  api<DailySummary[]>(`/meals/summary/week?days=${days}${from ? `&from=${from}` : ''}`);

export const createMeal = (body: CreateMealInput) =>
  api<Meal>('/meals', { method: 'POST', json: body });

export const updateMeal = (id: string, body: Partial<CreateMealInput>) =>
  api<Meal>(`/meals/${id}`, { method: 'PATCH', json: body });

export const deleteMeal = (id: string) => api<void>(`/meals/${id}`, { method: 'DELETE' });

export async function uploadMealPhoto(mealId: string, file: File): Promise<Meal> {
  const { env } = await import('@/config/env');
  const { useAuthStore } = await import('@/features/auth/auth.store');
  const token = useAuthStore.getState().accessToken;
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${env.apiBaseUrl}/meals/${encodeURIComponent(mealId)}/photo`, {
    method: 'POST',
    body: fd,
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `Upload failed (${res.status})`);
  }
  return (await res.json()) as Meal;
}

export const removeMealPhoto = (id: string) =>
  api<Meal>(`/meals/${id}/photo`, { method: 'DELETE' });
