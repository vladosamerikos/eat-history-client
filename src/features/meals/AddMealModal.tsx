import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, ChevronDown, Image as ImageIcon, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { listFoods, type Food } from '@/features/foods/foods.api';
import { estimateNutrition } from '@/features/ai/ai.api';
import { FoodPicker } from './FoodPicker';
import {
  createMeal,
  removeMealPhoto,
  updateMeal,
  uploadMealPhoto,
  type Meal,
  type MealEntry,
  type MealType,
} from './meals.api';
import { Alert } from '@/components/ui/Alert';

interface Props {
  date: string;
  type: MealType;
  meal?: Meal | null;
  onClose: () => void;
}

interface DraftItem {
  uid: string;
  food?: Food;
  customName: string;
  qty: string;
  gramsPerUnit: string;
  grams: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  entryPhoto?: File;
  entryPhotoUrl?: string;
}

const newId = () => Math.random().toString(36).slice(2, 10);

const emptyItem = (): DraftItem => ({
  uid: newId(),
  customName: '',
  qty: '1',
  gramsPerUnit: '0',
  grams: '0',
  kcal: '',
  protein: '',
  carbs: '',
  fat: '',
});

function entryToDraft(e: MealEntry, foodLookup?: Food): DraftItem {
  const grams = e.grams ?? 0;
  const gpu = foodLookup?.defaultPortionG ?? grams ?? 0;
  const qty = gpu > 0 ? Math.round((grams / gpu) * 100) / 100 : 1;
  return {
    uid: newId(),
    food: foodLookup,
    customName: e.customName ?? '',
    qty: foodLookup ? String(qty || 1) : '1',
    gramsPerUnit: foodLookup ? String(gpu) : '0',
    grams: String(grams),
    kcal: String(e.kcal ?? ''),
    protein: String(e.protein ?? ''),
    carbs: String(e.carbs ?? ''),
    fat: String(e.fat ?? ''),
  };
}

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function effectiveGrams(it: DraftItem): number {
  if (it.food) {
    const q = num(it.qty);
    const g = num(it.gramsPerUnit);
    return Math.round(q * g * 10) / 10;
  }
  return num(it.grams);
}

function computeMacros(it: DraftItem): { kcal: number; protein: number; carbs: number; fat: number } {
  if (it.food) {
    const factor = effectiveGrams(it) / 100;
    const np = it.food.nutritionPer100;
    return {
      kcal: Math.round((np.kcal ?? 0) * factor),
      protein: Math.round((np.protein ?? 0) * factor * 10) / 10,
      carbs: Math.round((np.carbs ?? 0) * factor * 10) / 10,
      fat: Math.round((np.fat ?? 0) * factor * 10) / 10,
    };
  }
  return {
    kcal: num(it.kcal),
    protein: num(it.protein),
    carbs: num(it.carbs),
    fat: num(it.fat),
  };
}

export function AddMealModal({ date, type, meal, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const isEdit = Boolean(meal);

  const [items, setItems] = useState<DraftItem[]>(
    meal?.entries?.length ? meal.entries.map((e) => entryToDraft(e)) : [emptyItem()],
  );
  const [pickerForUid, setPickerForUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | undefined>(meal?.photoUrl);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const previewPhoto = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : existingPhotoUrl),
    [photoFile, existingPhotoUrl],
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const entryFileRef = useRef<HTMLInputElement>(null);
  const [entryPhotoForUid, setEntryPhotoForUid] = useState<string | null>(null);

  // Pre-cargar foods cuando hay entries con foodId pendientes de hidratar.
  const needsHydration = isEdit && items.some((it) => !it.food && meal?.entries.some((e) => e.foodId));
  const { data: foods = [] } = useQuery<Food[]>({
    queryKey: ['foods', 'hydrate'],
    queryFn: () => listFoods(),
    enabled: needsHydration,
  });

  useEffect(() => {
    if (!isEdit || !meal) return;
    setItems((prev) => {
      let changed = false;
      const next = prev.map((it, idx) => {
        const entry = meal.entries[idx];
        if (it.food || !entry?.foodId) return it;
        const found = foods.find((f) => f._id === entry.foodId);
        if (found) {
          changed = true;
          // Re-hidratamos el draft completo para recalcular qty/gramsPerUnit a partir
          // del food y conservar los datos persistidos del entry.
          const rehydrated = entryToDraft(entry, found);
          return { ...rehydrated, uid: it.uid, entryPhoto: it.entryPhoto, entryPhotoUrl: it.entryPhotoUrl };
        }
        return it;
      });
      return changed ? next : prev;
    });
  }, [foods, isEdit, meal]);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, it) => {
        const m = computeMacros(it);
        return {
          kcal: acc.kcal + m.kcal,
          protein: acc.protein + m.protein,
          carbs: acc.carbs + m.carbs,
          fat: acc.fat + m.fat,
        };
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    );
  }, [items]);

  const updateItem = (uid: string, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it)));

  const removeItem = (uid: string) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.uid !== uid) : prev));

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const selectFood = (uid: string, food: Food) => {
    updateItem(uid, {
      food,
      customName: food.name,
      qty: '1',
      gramsPerUnit: String(food.defaultPortionG || 100),
      grams: String(food.defaultPortionG || 100),
    });
  };

  const aiAutocomplete = async (uid: string, mode: 'photo' | 'name') => {
    const item = items.find((i) => i.uid === uid);
    if (!item) return;
    setAiBusy(uid);
    setError(null);
    try {
      const photoForAi = mode === 'photo' ? (item.entryPhoto ?? photoFile ?? undefined) : undefined;
      const grams = effectiveGrams(item);
      const result = await estimateNutrition({
        image: photoForAi,
        name: mode === 'name' ? item.customName.trim() : item.customName.trim() || undefined,
        weightG: grams > 0 ? grams : undefined,
        locale: i18n.language,
      });
      const patch: Partial<DraftItem> = {};
      if (result.name && !item.customName.trim()) patch.customName = result.name;
      if (result.weightG && grams === 0) {
        patch.grams = String(Math.round(result.weightG));
        patch.gramsPerUnit = String(Math.round(result.weightG));
        patch.qty = '1';
      }
      if (result.kcal != null) patch.kcal = String(Math.round(result.kcal));
      if (result.proteinG != null) patch.protein = String(Math.round(result.proteinG * 10) / 10);
      if (result.carbsG != null) patch.carbs = String(Math.round(result.carbsG * 10) / 10);
      if (result.fatG != null) patch.fat = String(Math.round(result.fatG * 10) / 10);
      updateItem(uid, patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI estimation failed');
    } finally {
      setAiBusy(null);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const entries = items
        .filter((it) => it.food || it.customName.trim())
        .map((it) => {
          const grams = effectiveGrams(it) || 0;
          if (it.food) {
            return { foodId: it.food._id, grams };
          }
          return {
            customName: it.customName.trim() || 'Custom',
            grams,
            kcal: num(it.kcal),
            protein: num(it.protein),
            carbs: num(it.carbs),
            fat: num(it.fat),
          };
        });
      if (entries.length === 0) {
        throw new Error(t('meals.errors.noEntries') ?? 'Add at least one item');
      }

      const result: Meal = isEdit && meal
        ? await updateMeal(meal._id, { date, type, entries })
        : await createMeal({ date, type, entries });

      if (photoFile) {
        try {
          await uploadMealPhoto(result._id, photoFile);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Photo upload failed');
        }
      } else if (isEdit && !existingPhotoUrl && meal?.photoUrl) {
        try {
          await removeMealPhoto(result._id);
        } catch {
          /* ignored */
        }
      }
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meals', date] });
      qc.invalidateQueries({ queryKey: ['summary', date] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error'),
  });

  const canSubmit = items.some((it) => it.food || it.customName.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-background shadow-2xl sm:max-h-[88dvh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h3 className="truncate text-base font-semibold">
            {t(`meals.types.${type}`)} · {isEdit ? t('meals.edit') : t('meals.add')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex items-center justify-between gap-3 bg-muted/50 px-4 py-2 text-xs">
          <div>
            <span className="text-base font-semibold text-foreground">{Math.round(totals.kcal)}</span>{' '}
            <span className="text-muted-foreground">kcal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary dark:bg-primary/25">
              P {Math.round(totals.protein * 10) / 10}g
            </span>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300">
              C {Math.round(totals.carbs * 10) / 10}g
            </span>
            <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-rose-700 dark:bg-rose-500/25 dark:text-rose-300">
              G {Math.round(totals.fat * 10) / 10}g
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {error && <Alert variant="error">{error}</Alert>}

          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPhotoFile(f);
              }}
            />
            {previewPhoto ? (
              <div className="relative">
                <img src={previewPhoto} alt="" className="h-14 w-14 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoFile(null);
                    setExistingPhotoUrl(undefined);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                  className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-destructive text-xs text-white"
                  aria-label={t('meals.photo.remove')}
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-lg bg-muted text-muted-foreground">
                <ImageIcon className="h-5 w-5" />
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-3 text-sm font-medium hover:bg-muted"
            >
              <Camera className="h-4 w-4" />
              {previewPhoto ? t('meals.photo.change') : t('meals.photo.add')}
            </button>
          </div>

          {items.length > 1 && (
            <p className="text-[11px] text-muted-foreground">
              {t('meals.photo.generalHint') ?? 'Foto del plato completo (opcional)'}
            </p>
          )}

          <AnimatePresence initial={false}>
            {items.map((it, idx) => {
              const m = computeMacros(it);
              const totalG = effectiveGrams(it);
              const busy = aiBusy === it.uid;
              const entryPhotoPreview = it.entryPhoto
                ? URL.createObjectURL(it.entryPhoto)
                : it.entryPhotoUrl;
              const aiPhotoAvailable = Boolean(it.entryPhoto || photoFile);
              return (
                <motion.div
                  key={it.uid}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginTop: -8, transition: { duration: 0.15 } }}
                  className="rounded-xl border border-border bg-card p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium text-foreground">{m.kcal} kcal</span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(it.uid)}
                          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={t('common.remove') ?? 'Remove'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {it.food ? (
                    <>
                      <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-2 py-1.5">
                        <span className="truncate text-sm font-medium">{it.food.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            updateItem(it.uid, {
                              food: undefined,
                              customName: '',
                              qty: '1',
                              gramsPerUnit: '0',
                            })
                          }
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          {t('meals.changeFood')}
                        </button>
                      </div>
                      <div className="mb-2 grid grid-cols-[1fr,1fr,auto] items-end gap-2">
                        <NumField
                          label={t('meals.qty') ?? 'Cantidad'}
                          value={it.qty}
                          onChange={(v) => updateItem(it.uid, { qty: v })}
                        />
                        <NumField
                          label={t('meals.gramsPerUnit') ?? 'g / unidad'}
                          value={it.gramsPerUnit}
                          onChange={(v) => updateItem(it.uid, { gramsPerUnit: v })}
                        />
                        <div className="flex h-10 items-center rounded-lg bg-muted px-3 text-xs font-semibold tabular-nums">
                          = {Math.round(totalG)}g
                        </div>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPickerForUid(it.uid)}
                      className="mb-2 flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-background px-3 text-sm text-muted-foreground hover:bg-muted"
                    >
                      <span className="truncate">
                        {it.customName.trim() || (t('meals.pickOrType') ?? 'Elegir comida o escribir')}
                      </span>
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    </button>
                  )}

                  {!it.food && (
                    <input
                      value={it.customName}
                      onChange={(e) => updateItem(it.uid, { customName: e.target.value })}
                      placeholder={t('meals.customName') ?? 'Nombre del producto'}
                      className="mb-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  )}

                  <div className="grid grid-cols-5 gap-1.5">
                    {!it.food && (
                      <NumField
                        label="g"
                        value={it.grams}
                        onChange={(v) => updateItem(it.uid, { grams: v })}
                      />
                    )}
                    <NumField
                      label="kcal"
                      value={it.food ? String(m.kcal) : it.kcal}
                      onChange={(v) => updateItem(it.uid, { kcal: v })}
                      readOnly={!!it.food}
                    />
                    <NumField
                      label="P"
                      value={it.food ? String(m.protein) : it.protein}
                      onChange={(v) => updateItem(it.uid, { protein: v })}
                      readOnly={!!it.food}
                      tone="primary"
                    />
                    <NumField
                      label="C"
                      value={it.food ? String(m.carbs) : it.carbs}
                      onChange={(v) => updateItem(it.uid, { carbs: v })}
                      readOnly={!!it.food}
                      tone="amber"
                    />
                    <NumField
                      label="G"
                      value={it.food ? String(m.fat) : it.fat}
                      onChange={(v) => updateItem(it.uid, { fat: v })}
                      readOnly={!!it.food}
                      tone="rose"
                    />
                  </div>

                  {!it.food && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {entryPhotoPreview && (
                        <div className="relative">
                          <img
                            src={entryPhotoPreview}
                            alt=""
                            className="h-8 w-8 rounded-md object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateItem(it.uid, { entryPhoto: undefined, entryPhotoUrl: undefined })
                            }
                            className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-destructive text-[9px] text-white"
                            aria-label="x"
                          >
                            ×
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEntryPhotoForUid(it.uid);
                          entryFileRef.current?.click();
                        }}
                        className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-2.5 text-[11px] font-medium hover:bg-muted"
                      >
                        <Camera className="h-3 w-3" />
                        {entryPhotoPreview
                          ? (t('meals.entryPhoto.change') ?? 'Cambiar foto')
                          : (t('meals.entryPhoto.add') ?? 'Foto del producto')}
                      </button>
                      <button
                        type="button"
                        disabled={busy || !aiPhotoAvailable}
                        onClick={() => aiAutocomplete(it.uid, 'photo')}
                        title={!aiPhotoAvailable ? (t('meals.ai.needsPhoto') ?? 'Añade una foto primero') : undefined}
                        className="inline-flex h-8 items-center gap-1 rounded-full bg-primary/10 px-2.5 text-[11px] font-medium text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary/20 dark:text-primary-foreground"
                      >
                        {busy ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        {t('meals.ai.fromPhoto') ?? 'IA desde foto'}
                      </button>
                      <button
                        type="button"
                        disabled={busy || !it.customName.trim()}
                        onClick={() => aiAutocomplete(it.uid, 'name')}
                        title={!it.customName.trim() ? (t('meals.ai.needsName') ?? 'Escribe el nombre primero') : undefined}
                        className="inline-flex h-8 items-center gap-1 rounded-full bg-primary/10 px-2.5 text-[11px] font-medium text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary/20 dark:text-primary-foreground"
                      >
                        {busy ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        {t('meals.ai.fromName') ?? 'IA desde nombre'}
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          <button
            type="button"
            onClick={addItem}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('meals.addItem') ?? 'Añadir producto'}
          </button>
        </div>

        <footer className="border-t border-border bg-background px-4 py-3">
          <button
            type="button"
            disabled={!canSubmit || save.isPending}
            onClick={() => save.mutate()}
            className="h-11 w-full rounded-full bg-primary text-sm font-medium text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {save.isPending ? '…' : isEdit ? t('meals.saveEdit') : t('meals.confirm')}
          </button>
        </footer>
      </motion.div>

      <input
        ref={entryFileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && entryPhotoForUid) {
            updateItem(entryPhotoForUid, { entryPhoto: f, entryPhotoUrl: undefined });
          }
          setEntryPhotoForUid(null);
          if (entryFileRef.current) entryFileRef.current.value = '';
        }}
      />

      <FoodPicker
        open={pickerForUid !== null}
        onClose={() => setPickerForUid(null)}
        onSelect={(f) => {
          if (pickerForUid) selectFood(pickerForUid, f);
        }}
      />
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  readOnly,
  tone,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  tone?: 'primary' | 'amber' | 'rose';
}) {
  const toneCls =
    tone === 'primary'
      ? 'text-primary'
      : tone === 'amber'
        ? 'text-amber-600 dark:text-amber-400'
        : tone === 'rose'
          ? 'text-rose-600 dark:text-rose-400'
          : 'text-muted-foreground';
  return (
    <label className="flex flex-col gap-0.5">
      <span className={`text-[10px] font-medium uppercase tracking-wide ${toneCls}`}>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.1"
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className={`h-9 w-full rounded-md border border-border bg-background px-1.5 text-center text-xs font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40 ${readOnly ? 'opacity-70' : ''}`}
      />
    </label>
  );
}
