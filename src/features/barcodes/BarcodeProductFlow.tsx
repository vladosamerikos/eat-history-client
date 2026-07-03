import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Barcode,
  Check,
  ChevronLeft,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/Alert';
import { MacroInlineStat } from '@/components/ui/MacroChips';
import { MacroInputRow } from '@/components/ui/MacroInputRow';
import { PhotoCard } from '@/components/ui/PhotoCard';
import { PhotoSourceSheet } from '@/components/ui/PhotoSourceSheet';
import type { Food } from '@/features/foods/foods.api';
import { ApiError } from '@/lib/api';
import { BarcodeCamera } from './BarcodeCamera';
import {
  analyzeNutritionLabel,
  lookupBarcode,
  uploadBarcodeImage,
  upsertBarcodeProduct,
  type BarcodeNutrition,
  type BarcodeProductResponse,
  type NutritionLabelAnalysis,
} from './barcode.api';

type Phase = 'scan' | 'loading' | 'found' | 'edit';
type Basis = 'per100' | 'perServing';
type PhotoKind = 'nutrition-label' | 'product';

interface NutritionFields {
  kcal: string;
  protein: string;
  carbs: string;
  sugars: string;
  fat: string;
  saturatedFat: string;
  fiber: string;
  salt: string;
}

interface ProductForm {
  name: string;
  brand: string;
  quantity: string;
  servingSizeG: string;
  servingDescription: string;
  per100: NutritionFields;
  perServing: NutritionFields;
  source: 'manual' | 'nutrition-label-ai' | 'import';
  confidence?: number;
  notes?: string;
}

const emptyNutrition = (): NutritionFields => ({
  kcal: '',
  protein: '',
  carbs: '',
  sugars: '',
  fat: '',
  saturatedFat: '',
  fiber: '',
  salt: '',
});

const emptyForm = (): ProductForm => ({
  name: '',
  brand: '',
  quantity: '',
  servingSizeG: '100',
  servingDescription: '',
  per100: emptyNutrition(),
  perServing: emptyNutrition(),
  source: 'manual',
});

function toFields(value?: BarcodeNutrition): NutritionFields {
  const out = emptyNutrition();
  if (!value) return out;
  return (Object.keys(out) as Array<keyof NutritionFields>).reduce((result, key) => {
    const item = value[key];
    return item === undefined ? result : { ...result, [key]: String(item) };
  }, out);
}

function toNutrition(value: NutritionFields): BarcodeNutrition | undefined {
  const result = (Object.keys(value) as Array<keyof NutritionFields>).reduce<BarcodeNutrition>(
    (output, key) => {
      const raw = value[key].trim();
      if (!raw) return output;
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed >= 0 ? { ...output, [key]: parsed } : output;
    },
    {},
  );
  return Object.keys(result).length ? result : undefined;
}

function formFromResponse(response: BarcodeProductResponse): ProductForm {
  const { product } = response;
  return {
    name: product.name,
    brand: product.brand ?? '',
    quantity: product.quantity ?? '',
    servingSizeG: product.servingSizeG ? String(product.servingSizeG) : '100',
    servingDescription: product.servingDescription ?? '',
    per100: toFields(product.nutritionPer100),
    perServing: toFields(product.nutritionPerServing),
    source: product.source,
    confidence: product.confidence,
    notes: product.notes,
  };
}

function usePreview(file: File | null, fallback?: string): string | undefined {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : fallback), [file, fallback]);
  useEffect(
    () => () => {
      if (file && preview) URL.revokeObjectURL(preview);
    },
    [file, preview],
  );
  return preview;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (food: Food) => void;
}

export function BarcodeProductFlow({ open, onClose, onSelect }: Props) {
  const { t, i18n } = useTranslation();
  const [phase, setPhase] = useState<Phase>('scan');
  const [barcode, setBarcode] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [result, setResult] = useState<BarcodeProductResponse | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [basis, setBasis] = useState<Basis>('per100');
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [photoKind, setPhotoKind] = useState<PhotoKind | null>(null);
  const [labelBusy, setLabelBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labelPreview = usePreview(labelFile, result?.product.nutritionLabelImageUrl);
  const productPreview = usePreview(productFile, result?.product.productImageUrl);

  useEffect(() => {
    if (!open) return;
    setPhase('scan');
    setBarcode('');
    setManualCode('');
    setResult(null);
    setForm(emptyForm());
    setBasis('per100');
    setLabelFile(null);
    setProductFile(null);
    setError(null);
  }, [open]);

  const findProduct = useCallback(
    async (raw: string) => {
      const code = raw.trim().replace(/[\s-]/g, '');
      if (!/^\d{8,14}$/.test(code)) {
        setError(t('barcodes.invalid') ?? 'Introduce un código de 8 a 14 dígitos.');
        return;
      }
      setBarcode(code);
      setManualCode(code);
      setPhase('loading');
      setError(null);
      try {
        const found = await lookupBarcode(code);
        setResult(found);
        setForm(formFromResponse(found));
        setBasis(found.product.nutritionPer100 ? 'per100' : 'perServing');
        setPhase('found');
      } catch (reason) {
        if (reason instanceof ApiError && reason.status === 404) {
          setResult(null);
          setForm(emptyForm());
          setPhase('edit');
          return;
        }
        setError(reason instanceof Error ? reason.message : 'Barcode lookup failed');
        setPhase('scan');
      }
    },
    [t],
  );
  const handleDetected = useCallback(
    (value: string) => {
      findProduct(value);
    },
    [findProduct],
  );

  const applyAnalysis = (analysis: NutritionLabelAnalysis) => {
    setForm((previous) => ({
      ...previous,
      name: analysis.name ?? previous.name,
      brand: analysis.brand ?? previous.brand,
      quantity: analysis.quantity ?? previous.quantity,
      servingSizeG: analysis.servingSizeG ? String(analysis.servingSizeG) : previous.servingSizeG,
      servingDescription: analysis.servingDescription ?? previous.servingDescription,
      per100: analysis.nutritionPer100 ? toFields(analysis.nutritionPer100) : previous.per100,
      perServing: analysis.nutritionPerServing
        ? toFields(analysis.nutritionPerServing)
        : previous.perServing,
      source: 'nutrition-label-ai',
      confidence: analysis.confidence,
      notes: analysis.notes,
    }));
    setBasis(analysis.nutritionPer100 ? 'per100' : 'perServing');
  };

  const handleLabelFile = async (file: File) => {
    setLabelFile(file);
    setLabelBusy(true);
    setError(null);
    try {
      const analysis = await analyzeNutritionLabel(file, i18n.language?.split('-')[0]);
      applyAnalysis(analysis);
      toast.success(t('barcodes.labelAnalyzed') ?? 'Etiqueta analizada');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Nutrition label analysis failed');
    } finally {
      setLabelBusy(false);
    }
  };

  const save = async () => {
    if (!form.name.trim()) {
      setError(t('barcodes.nameRequired') ?? 'Añade el nombre del producto.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let saved = await upsertBarcodeProduct(barcode, {
        name: form.name.trim(),
        brand: form.brand.trim() || undefined,
        quantity: form.quantity.trim() || undefined,
        servingSizeG: Number(form.servingSizeG) || undefined,
        servingDescription: form.servingDescription.trim() || undefined,
        nutritionPer100: toNutrition(form.per100),
        nutritionPerServing: toNutrition(form.perServing),
        source: form.source,
        confidence: form.confidence,
        notes: form.notes,
      });
      if (labelFile) {
        saved = await uploadBarcodeImage(barcode, 'nutrition-label', labelFile);
      }
      if (productFile) {
        saved = await uploadBarcodeImage(barcode, 'product', productFile);
      }
      toast.success(t('barcodes.saved') ?? 'Producto guardado');
      onSelect(saved.food);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save barcode product');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  const activeNutrition = basis === 'per100' ? form.per100 : form.perServing;
  const setNutrition = (patch: Partial<NutritionFields>) =>
    setForm((previous) => ({
      ...previous,
      [basis]: { ...previous[basis], ...patch },
    }));

  return (
    <div className="fixed inset-0 z-[80] flex bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-surface sm:m-auto sm:h-auto sm:max-h-[94dvh] sm:max-w-lg sm:rounded-3xl"
      >
        <header className="flex items-center justify-between border-b border-surface-variant px-4 py-3">
          <button
            type="button"
            onClick={() => {
              if (phase === 'scan') onClose();
              else setPhase('scan');
            }}
            className="grid h-10 w-10 place-items-center rounded-full bg-surface-container"
            aria-label={phase === 'scan' ? t('common.close') : t('common.back')}
          >
            {phase === 'scan' ? <X className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
          <div className="text-center">
            <h2 className="text-base font-bold">{t('barcodes.title') ?? 'Escanear producto'}</h2>
            {barcode && <p className="font-mono text-[10px] text-on-surface-variant">{barcode}</p>}
          </div>
          <div className="w-10" />
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-28 pt-4">
          {error && <Alert variant="error">{error}</Alert>}

          {phase === 'scan' && (
            <>
              <BarcodeCamera active onDetected={handleDetected} />
              <p className="text-center text-xs text-on-surface-variant">
                {t('barcodes.scanHint') ??
                  'Alinea el código de barras dentro del recuadro. La búsqueda es automática.'}
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  findProduct(manualCode);
                }}
                className="flex gap-2 rounded-xl border border-surface-variant bg-surface-container-low p-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
                  <Barcode className="h-4 w-4 text-primary" />
                  <input
                    value={manualCode}
                    onChange={(event) => setManualCode(event.target.value)}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={t('barcodes.manualPlaceholder') ?? 'Introducir código'}
                    className="h-10 min-w-0 flex-1 bg-transparent font-mono text-sm focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground"
                  aria-label={t('barcodes.lookup') ?? 'Buscar'}
                >
                  <Search className="h-4 w-4" />
                </button>
              </form>
            </>
          )}

          {phase === 'loading' && (
            <div className="grid min-h-[50dvh] place-items-center">
              <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <p className="mt-3 text-sm text-on-surface-variant">
                  {t('barcodes.lookingUp') ?? 'Buscando producto…'}
                </p>
              </div>
            </div>
          )}

          {phase === 'found' && result && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-surface-variant bg-surface-container-low">
                {result.product.productImageUrl ? (
                  <img
                    src={result.product.productImageUrl}
                    alt=""
                    className="h-48 w-full object-cover"
                  />
                ) : (
                  <div className="grid h-36 place-items-center bg-primary/5">
                    <Barcode className="h-12 w-12 text-primary/50" />
                  </div>
                )}
                <div className="space-y-2 p-5">
                  <div>
                    <p className="text-lg font-bold">{result.product.name}</p>
                    <p className="text-sm text-on-surface-variant">
                      {[result.product.brand, result.product.quantity].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    <MacroInlineStat
                      macro="kcal"
                      value={result.food.nutritionPer100.kcal}
                      unit="kcal/100g"
                    />
                    <MacroInlineStat macro="protein" value={result.food.nutritionPer100.protein} />
                    <MacroInlineStat macro="carbs" value={result.food.nutritionPer100.carbs} />
                    <MacroInlineStat macro="fat" value={result.food.nutritionPer100.fat} />
                  </div>
                  {result.product.servingSizeG && (
                    <p className="text-xs text-on-surface-variant">
                      {t('barcodes.portion') ?? 'Porción'}: {result.product.servingSizeG} g
                      {result.product.servingDescription
                        ? ` · ${result.product.servingDescription}`
                        : ''}
                    </p>
                  )}
                </div>
              </div>
              {result.product.nutritionLabelImageUrl && (
                <div className="rounded-xl border border-surface-variant p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {t('barcodes.nutritionLabel') ?? 'Etiqueta nutricional'}
                  </p>
                  <img
                    src={result.product.nutritionLabelImageUrl}
                    alt=""
                    className="max-h-48 w-full rounded-lg object-contain"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPhase('edit')}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-surface-variant text-sm font-semibold"
                >
                  <Pencil className="h-4 w-4" />
                  {t('common.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(result.food);
                    onClose();
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground"
                >
                  <Check className="h-4 w-4" />
                  {t('barcodes.useProduct') ?? 'Usar producto'}
                </button>
              </div>
            </div>
          )}

          {phase === 'edit' && (
            <div className="space-y-4">
              {!result && (
                <Alert>
                  {t('barcodes.notFound') ??
                    'No está en la base de datos. Completa los datos o fotografía la tabla nutricional.'}
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-3">
                <PhotoCard
                  previewUrl={labelPreview}
                  onPick={() => setPhotoKind('nutrition-label')}
                  onRemove={() => setLabelFile(null)}
                  emptyIcon={
                    labelBusy ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <Sparkles className="h-5 w-5 text-primary" />
                    )
                  }
                  emptyLabel={t('barcodes.nutritionLabel') ?? 'Tabla nutricional'}
                />
                <PhotoCard
                  previewUrl={productPreview}
                  onPick={() => setPhotoKind('product')}
                  onRemove={() => setProductFile(null)}
                  emptyIcon={<ImageIcon className="h-5 w-5 text-primary" />}
                  emptyLabel={t('barcodes.productPhoto') ?? 'Foto del envase'}
                />
              </div>
              {labelBusy && (
                <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-3 text-xs text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('barcodes.analyzingLabel') ?? 'Analizando la tabla nutricional…'}
                </div>
              )}

              <div className="space-y-4 rounded-xl border border-surface-variant bg-surface-container-low p-4">
                <label
                  htmlFor="barcode-product-name"
                  className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant"
                >
                  {t('foods.fields.name')}
                  <input
                    id="barcode-product-name"
                    value={form.name}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, name: event.target.value }))
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-surface-variant bg-transparent px-3 text-sm normal-case tracking-normal focus:border-primary focus:outline-none"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    htmlFor="barcode-product-brand"
                    className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant"
                  >
                    {t('barcodes.brand') ?? 'Marca'}
                    <input
                      id="barcode-product-brand"
                      value={form.brand}
                      onChange={(event) =>
                        setForm((previous) => ({ ...previous, brand: event.target.value }))
                      }
                      className="mt-1 h-10 w-full rounded-lg border border-surface-variant bg-transparent px-3 text-sm normal-case tracking-normal focus:border-primary focus:outline-none"
                    />
                  </label>
                  <label
                    htmlFor="barcode-product-quantity"
                    className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant"
                  >
                    {t('barcodes.quantity') ?? 'Cantidad envase'}
                    <input
                      id="barcode-product-quantity"
                      value={form.quantity}
                      onChange={(event) =>
                        setForm((previous) => ({ ...previous, quantity: event.target.value }))
                      }
                      placeholder="400 g"
                      className="mt-1 h-10 w-full rounded-lg border border-surface-variant bg-transparent px-3 text-sm normal-case tracking-normal focus:border-primary focus:outline-none"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    htmlFor="barcode-product-serving-size"
                    className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant"
                  >
                    {t('barcodes.portionGrams') ?? 'Porción'}
                    <div className="mt-1 flex h-10 overflow-hidden rounded-lg border border-surface-variant">
                      <input
                        id="barcode-product-serving-size"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        value={form.servingSizeG}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            servingSizeG: event.target.value,
                          }))
                        }
                        className="min-w-0 flex-1 bg-transparent px-3 text-sm normal-case tracking-normal focus:outline-none"
                      />
                      <span className="grid place-items-center border-l border-surface-variant px-2 text-xs">
                        g
                      </span>
                    </div>
                  </label>
                  <label
                    htmlFor="barcode-product-serving-description"
                    className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant"
                  >
                    {t('barcodes.portionDescription') ?? 'Descripción'}
                    <input
                      id="barcode-product-serving-description"
                      value={form.servingDescription}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          servingDescription: event.target.value,
                        }))
                      }
                      placeholder="1 barrita"
                      className="mt-1 h-10 w-full rounded-lg border border-surface-variant bg-transparent px-3 text-sm normal-case tracking-normal focus:border-primary focus:outline-none"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-surface-variant bg-surface-container-low p-4">
                <div className="grid grid-cols-2 rounded-full bg-surface-container p-1">
                  {(['per100', 'perServing'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBasis(value)}
                      className={`h-9 rounded-full text-xs font-semibold ${
                        basis === value
                          ? 'bg-primary text-primary-foreground'
                          : 'text-on-surface-variant'
                      }`}
                    >
                      {value === 'per100'
                        ? (t('barcodes.per100') ?? 'Por 100 g')
                        : (t('barcodes.perServing') ?? 'Por porción')}
                    </button>
                  ))}
                </div>
                <MacroInputRow
                  msIcon="local_fire_department"
                  iconClass="text-primary"
                  label={t('foods.fields.kcal100')}
                  unit="kcal"
                  value={activeNutrition.kcal}
                  onChange={(value) => setNutrition({ kcal: value })}
                />
                <MacroInputRow
                  msIcon="egg_alt"
                  iconClass="text-primary"
                  label={t('foods.fields.protein')}
                  unit="g"
                  value={activeNutrition.protein}
                  onChange={(value) => setNutrition({ protein: value })}
                />
                <MacroInputRow
                  msIcon="bakery_dining"
                  iconClass="text-amber-400"
                  label={t('foods.fields.carbs')}
                  unit="g"
                  value={activeNutrition.carbs}
                  onChange={(value) => setNutrition({ carbs: value })}
                />
                <MacroInputRow
                  msIcon="opacity"
                  iconClass="text-rose-400"
                  label={t('foods.fields.fat')}
                  unit="g"
                  value={activeNutrition.fat}
                  onChange={(value) => setNutrition({ fat: value })}
                />
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['sugars', t('barcodes.sugars') ?? 'Azúcares'],
                      ['saturatedFat', t('barcodes.saturatedFat') ?? 'Grasas saturadas'],
                      ['fiber', t('barcodes.fiber') ?? 'Fibra'],
                      ['salt', t('barcodes.salt') ?? 'Sal'],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      htmlFor={`barcode-${basis}-${key}`}
                      className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant"
                    >
                      {label}
                      <div className="mt-1 flex h-9 overflow-hidden rounded-lg border border-surface-variant">
                        <input
                          id={`barcode-${basis}-${key}`}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={activeNutrition[key]}
                          onChange={(event) => setNutrition({ [key]: event.target.value })}
                          className="min-w-0 flex-1 bg-transparent px-2 text-sm normal-case tracking-normal focus:outline-none"
                        />
                        <span className="grid place-items-center border-l border-surface-variant px-2 text-[10px]">
                          g
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {phase === 'edit' && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-surface via-surface/95 to-transparent px-5 pb-5 pt-12">
            <button
              type="button"
              disabled={saving || labelBusy || !form.name.trim()}
              onClick={() => save()}
              className="pointer-events-auto h-14 w-full rounded-full bg-primary-container text-base font-bold text-on-primary-container shadow-lg disabled:opacity-50"
            >
              {saving ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : t('barcodes.save')}
            </button>
          </div>
        )}
      </motion.div>

      <PhotoSourceSheet
        open={photoKind !== null}
        onClose={() => setPhotoKind(null)}
        title={
          photoKind === 'nutrition-label'
            ? (t('barcodes.captureLabel') ?? 'Fotografía la tabla nutricional')
            : (t('barcodes.captureProduct') ?? 'Fotografía el envase')
        }
        onFile={(file) => {
          if (photoKind === 'nutrition-label') handleLabelFile(file);
          else setProductFile(file);
        }}
      />
    </div>
  );
}
