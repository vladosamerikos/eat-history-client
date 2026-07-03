import { env } from '@/config/env';
import type { Food } from '@/features/foods/foods.api';
import { api, authenticatedFetch } from '@/lib/api';

export interface BarcodeNutrition {
  kcal?: number;
  protein?: number;
  carbs?: number;
  sugars?: number;
  fat?: number;
  saturatedFat?: number;
  fiber?: number;
  salt?: number;
}

export interface BarcodeProduct {
  _id: string;
  barcode: string;
  barcodeFormat: string;
  checkDigitValid: boolean;
  foodId: string;
  name: string;
  brand?: string;
  quantity?: string;
  servingSizeG?: number;
  servingDescription?: string;
  nutritionPer100?: BarcodeNutrition;
  nutritionPerServing?: BarcodeNutrition;
  productImageUrl?: string;
  nutritionLabelImageUrl?: string;
  source: 'manual' | 'nutrition-label-ai' | 'import';
  confidence?: number;
  notes?: string;
  lookupCount: number;
  updatedAt: string;
}

export interface BarcodeProductResponse {
  product: BarcodeProduct;
  food: Food;
}

export interface BarcodeProductInput {
  name: string;
  brand?: string;
  quantity?: string;
  servingSizeG?: number;
  servingDescription?: string;
  nutritionPer100?: BarcodeNutrition;
  nutritionPerServing?: BarcodeNutrition;
  source?: BarcodeProduct['source'];
  confidence?: number;
  notes?: string;
}

export interface NutritionLabelAnalysis extends BarcodeProductInput {
  modelUsed: string;
  provider: string;
}

export const lookupBarcode = (barcode: string): Promise<BarcodeProductResponse> =>
  api(`/barcode-products/${encodeURIComponent(barcode)}`);

export const upsertBarcodeProduct = (
  barcode: string,
  input: BarcodeProductInput,
): Promise<BarcodeProductResponse> =>
  api(`/barcode-products/${encodeURIComponent(barcode)}`, {
    method: 'PUT',
    json: input,
  });

export async function analyzeNutritionLabel(
  file: File,
  locale?: string,
): Promise<NutritionLabelAnalysis> {
  const form = new FormData();
  form.append('file', file);
  if (locale) form.append('locale', locale);
  const response = await authenticatedFetch(`${env.apiBaseUrl}/barcode-products/analyze-label`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as NutritionLabelAnalysis;
}

export async function uploadBarcodeImage(
  barcode: string,
  kind: 'product' | 'nutrition-label',
  file: File,
): Promise<BarcodeProductResponse> {
  const form = new FormData();
  form.append('file', file);
  const response = await authenticatedFetch(
    `${env.apiBaseUrl}/barcode-products/${encodeURIComponent(barcode)}/images/${kind}`,
    { method: 'POST', body: form },
  );
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as BarcodeProductResponse;
}
