import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  BookmarkPlus,
  Camera,
  Image as ImageIcon,
  Loader2,
  Mic,
  Plus,
  ScanBarcode,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { MSIcon } from '@/components/ui/MSIcon';
import { MacroBadge } from '@/components/ui/MacroChips';
import { MacroInputRow } from '@/components/ui/MacroInputRow';
import { PhotoSourceSheet } from '@/components/ui/PhotoSourceSheet';
import { PhotoCard } from '@/components/ui/PhotoCard';
import { createFood, listFoods, type Food } from '@/features/foods/foods.api';
import { estimateNutrition, analyzeMealPhoto } from '@/features/ai/ai.api';
import { useVoice } from '@/features/voice/VoiceContext';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { FoodCombobox } from './FoodCombobox';
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
import { BarcodeProductFlow } from '@/features/barcodes/BarcodeProductFlow';

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
}

const newId = () => Math.random().toString(36).slice(2, 10);

const emptyItem = (): DraftItem => ({
  uid: newId(),
  customName: '',
  qty: '1',
  gramsPerUnit: '100',
  grams: '100',
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
  const gpu = num(it.gramsPerUnit);
  if (gpu > 0) {
    const q = num(it.qty);
    return Math.round(q * gpu * 10) / 10;
  }
  return num(it.grams);
}

function computeMacros(it: DraftItem): {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
} {
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

function itemHasData(it: DraftItem): boolean {
  return !!(
    it.food ||
    it.customName.trim() ||
    num(it.kcal) > 0 ||
    num(it.protein) > 0 ||
    num(it.carbs) > 0 ||
    num(it.fat) > 0
  );
}

export function AddMealModal({ date, type, meal, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const voice = useVoice();
  const isEdit = Boolean(meal);

  const [items, setItems] = useState<DraftItem[]>(
    meal?.entries?.length ? meal.entries.map((e) => entryToDraft(e)) : [emptyItem()],
  );
  const [error, setError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | undefined>(meal?.photoUrl);
  const [photoExplicitlyRemoved, setPhotoExplicitlyRemoved] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | 'global' | null>(null);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  // Per-item photo analysis sheet
  const [itemPhotoSheetUid, setItemPhotoSheetUid] = useState<string | null>(null);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [barcodeTargetUid, setBarcodeTargetUid] = useState<string | null>(null);

  const previewPhoto = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : existingPhotoUrl),
    [photoFile, existingPhotoUrl],
  );
  // refs replaced by PhotoSourceSheet

  const needsHydration =
    isEdit && items.some((it) => !it.food && meal?.entries.some((e) => e.foodId));
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
          const rehydrated = entryToDraft(entry, found);
          return { ...rehydrated, uid: it.uid };
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

  const openBarcode = (uid?: string) => {
    if (uid) {
      setBarcodeTargetUid(uid);
    } else {
      const available = items.find((item) => !itemHasData(item));
      if (available) {
        setBarcodeTargetUid(available.uid);
      } else {
        const next = emptyItem();
        setItems((previous) => [...previous, next]);
        setBarcodeTargetUid(next.uid);
      }
    }
    setBarcodeOpen(true);
  };

  const aiAutocomplete = async (uid: string, mode: 'photo' | 'name') => {
    const item = items.find((i) => i.uid === uid);
    if (!item) return;
    setAiBusy(uid);
    setError(null);
    try {
      const photoForAi = mode === 'photo' ? (photoFile ?? undefined) : undefined;
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

  /**
   * Análisis IA de UN ingrediente con foto específica (no necesariamente la foto principal
   * del plato). Sube el File pasado y lo usa para estimar macros para ese item.
   */
  const analyzeItemPhoto = async (uid: string, file: File) => {
    const item = items.find((i) => i.uid === uid);
    if (!item) return;
    setAiBusy(uid);
    setError(null);
    try {
      const grams = effectiveGrams(item);
      const result = await estimateNutrition({
        image: file,
        name: item.customName.trim() || undefined,
        weightG: grams > 0 ? grams : undefined,
        locale: i18n.language,
      });
      const patch: Partial<DraftItem> = {};
      if (result.name && !item.customName.trim()) patch.customName = result.name;
      if (result.weightG) {
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

  /**
   * Análisis IA del plato completo: detecta TODOS los ingredientes visibles
   * y crea un DraftItem por cada uno (reemplaza los items actuales).
   */
  const analyzeFullPhoto = async () => {
    if (!photoFile && !existingPhotoUrl) return;
    const itemsHaveData = items.some(itemHasData);
    if (itemsHaveData) {
      const ok = await confirm({
        title: t('meals.confirmOverwriteTitle') ?? '¿Sobrescribir datos?',
        description:
          t('meals.confirmOverwrite') ??
          'Ya hay información introducida. ¿Reemplazar con el análisis IA?',
        confirmText: t('meals.analyzePhoto') ?? 'Analizar',
      });
      if (!ok) return;
    }
    setAiBusy('global');
    setError(null);
    try {
      // Obtiene el File: usa el local si existe, si no descarga el remoto.
      let file: File | null = photoFile;
      if (!file && existingPhotoUrl) {
        const res = await fetch(existingPhotoUrl, { credentials: 'include' });
        if (!res.ok) throw new Error('No se pudo descargar la foto existente');
        const blob = await res.blob();
        const ext = existingPhotoUrl.split('.').pop()?.toLowerCase() ?? 'jpg';
        file = new File([blob], `meal-photo.${ext}`, { type: blob.type || 'image/jpeg' });
      }
      if (!file) return;
      const analysis = await analyzeMealPhoto({
        image: file,
        locale: i18n.language?.split('-')[0],
      });
      if (analysis.items.length === 0) {
        setError(analysis.notes ?? 'La IA no detectó ningún alimento.');
        return;
      }
      const drafts: DraftItem[] = analysis.items.map((it) => ({
        uid: newId(),
        customName: it.name,
        qty: '1',
        gramsPerUnit: String(it.weightG || 100),
        grams: String(it.weightG || 0),
        kcal: String(Math.round(it.kcal)),
        protein: String(Math.round(it.proteinG * 10) / 10),
        carbs: String(Math.round(it.carbsG * 10) / 10),
        fat: String(Math.round(it.fatG * 10) / 10),
      }));
      setItems(drafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI analyze failed');
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

      const result: Meal =
        isEdit && meal
          ? await updateMeal(meal._id, { date, type, entries })
          : await createMeal({ date, type, entries });

      if (photoFile) {
        try {
          await uploadMealPhoto(result._id, photoFile);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Photo upload failed');
        }
      } else if (isEdit && photoExplicitlyRemoved && meal?.photoUrl) {
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
      toast.success(t('common.saved'));
      onClose();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : t('common.errorGeneric');
      setError(msg);
      toast.error(msg);
    },
  });

  const saveAsFood = useMutation({
    mutationFn: async (uid: string) => {
      const it = items.find((i) => i.uid === uid);
      if (!it) throw new Error('Item not found');
      const name = it.customName.trim();
      if (!name) throw new Error(t('meals.errors.noName') ?? 'Add a name first');
      const grams = effectiveGrams(it) || 100;
      const factor = grams > 0 ? 100 / grams : 1;
      const np = {
        kcal: Math.round(num(it.kcal) * factor),
        protein: Math.round(num(it.protein) * factor * 10) / 10,
        carbs: Math.round(num(it.carbs) * factor * 10) / 10,
        fat: Math.round(num(it.fat) * factor * 10) / 10,
      };
      const food = await createFood({
        name,
        defaultPortionG: Math.round(grams),
        nutritionPer100: np,
      });
      updateItem(uid, {
        food,
        customName: food.name,
        qty: '1',
        gramsPerUnit: String(food.defaultPortionG || Math.round(grams)),
        grams: String(food.defaultPortionG || Math.round(grams)),
      });
      return food;
    },
    onSuccess: (food) => {
      qc.invalidateQueries({ queryKey: ['foods'] });
      toast.success(t('meals.savedAsFood', { name: food.name }) ?? `“${food.name}” guardado`);
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : t('common.errorGeneric'));
    },
  });

  const canSubmit = items.some((it) => it.food || it.customName.trim());

  const openVoice = () => {
    voice.open({
      onChanged: () => {
        qc.invalidateQueries({ queryKey: ['meals'] });
        qc.invalidateQueries({ queryKey: ['weights'] });
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-surface/95 px-5 py-4 backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full border border-surface-variant bg-surface-container text-on-surface-variant transition-colors hover:text-primary"
            aria-label={t('common.close') ?? 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-on-background">
            {isEdit ? t('meals.edit') : t('meals.add')} · {t(`meals.types.${type}`)}
          </h1>
          <div className="w-10" />
        </header>

        {/* Scrollable body */}
        <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-32">
          {error && <Alert variant="error">{error}</Alert>}

          {/* Summary Strip estilo Stitch: icono Flame grande + kcal grande, macros sin label */}
          <div className="flex flex-col gap-3 rounded-xl border border-surface-variant/30 bg-surface-container-low/50 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl bg-primary/10">
                <MSIcon name="local_fire_department" size={28} className="text-primary" />
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[34px] font-bold leading-none tabular-nums text-on-background">
                  {totals.kcal}
                </span>
                <span className="text-xs font-medium text-on-surface-variant">kcal</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MacroBadge
                macro="protein"
                label={t('meals.macros.protein')}
                value={totals.protein}
              />
              <MacroBadge macro="carbs" label={t('meals.macros.carbs')} value={totals.carbs} />
              <MacroBadge macro="fat" label={t('meals.macros.fat')} value={totals.fat} />
            </div>
          </div>

          {/* AI Photo Analysis Card */}
          <PhotoCard
            previewUrl={previewPhoto}
            onPick={() => setPhotoSheetOpen(true)}
            onRemove={() => {
              setPhotoFile(null);
              setExistingPhotoUrl(undefined);
              setPhotoExplicitlyRemoved(true);
            }}
            emptyLabel={t('meals.aiPhotoTitle') ?? 'AI Análisis por foto'}
            extraAction={
              <motion.button
                type="button"
                onClick={analyzeFullPhoto}
                disabled={aiBusy === 'global'}
                whileTap={{ scale: 0.95 }}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-lg disabled:opacity-60"
              >
                {aiBusy === 'global' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {t('meals.analyzePhoto') ?? 'Analizar'}
              </motion.button>
            }
          />

          <button
            type="button"
            onClick={() => openBarcode()}
            className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-left text-primary transition-colors hover:bg-primary/15"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
              <ScanBarcode className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">
                {t('barcodes.scanCta') ?? 'Escanear código de barras'}
              </span>
              <span className="block text-[11px] text-on-surface-variant">
                {t('barcodes.scanCtaHelp') ??
                  'Busca el producto o crea su ficha desde la etiqueta nutricional.'}
              </span>
            </span>
          </button>

          {/* Items Form Card */}
          <div className="relative space-y-6 rounded-xl border border-surface-variant bg-surface-container-low p-6">
            <AnimatePresence initial={false}>
              {items.map((it, idx) => {
                const m = computeMacros(it);
                const totalG = effectiveGrams(it);
                const busy = aiBusy === it.uid;
                return (
                  <motion.div
                    key={it.uid}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginTop: -16, transition: { duration: 0.15 } }}
                    className="flex flex-col gap-4"
                  >
                    {/* Name row */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                          #{idx + 1} {t('meals.itemLabel') ?? 'Plato'}
                        </label>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(it.uid)}
                            className="grid h-7 w-7 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label={t('common.remove') ?? 'Remove'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <FoodCombobox
                        value={it.customName || it.food?.name || ''}
                        food={it.food ?? null}
                        onTextChange={(text) => updateItem(it.uid, { customName: text })}
                        onPickFood={(f) => selectFood(it.uid, f)}
                        onClearFood={() =>
                          updateItem(it.uid, {
                            food: undefined,
                            qty: '1',
                            gramsPerUnit: '0',
                          })
                        }
                        actionSlot={
                          <div className="flex flex-shrink-0 items-center gap-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => openBarcode(it.uid)}
                              title={t('barcodes.scanCta') ?? 'Escanear código'}
                              className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={t('barcodes.scanCta') ?? 'Escanear código'}
                            >
                              <ScanBarcode className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setItemPhotoSheetUid(it.uid)}
                              title={t('meals.ai.fromPhoto') ?? 'IA desde foto'}
                              className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={t('meals.ai.fromPhoto') ?? 'IA desde foto'}
                            >
                              <Camera className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busy || !it.customName.trim()}
                              onClick={() => aiAutocomplete(it.uid, 'name')}
                              title={t('meals.ai.fromName') ?? 'IA desde nombre'}
                              className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={t('meals.ai.fromName') ?? 'IA desde nombre'}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        }
                      />
                    </div>

                    {/* Qty + grams */}
                    <div className="flex min-w-0 items-end gap-3">
                      <div className="flex w-20 flex-shrink-0 flex-col gap-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                          {t('meals.qty') ?? 'Cantidad'}
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.1"
                          value={it.qty}
                          onChange={(e) => updateItem(it.uid, { qty: e.target.value })}
                          className="no-spin h-10 w-full rounded-lg border border-surface-variant bg-surface-container-low px-3 text-sm text-on-background focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                          {t('meals.gramsPerUnit') ?? 'g / unidad'}
                        </label>
                        <div className="flex h-10 min-w-0 overflow-hidden rounded-lg border border-surface-variant bg-surface-container-low">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            value={it.gramsPerUnit}
                            onChange={(e) => updateItem(it.uid, { gramsPerUnit: e.target.value })}
                            className="no-spin min-w-0 flex-1 border-none bg-transparent px-3 text-sm text-on-background focus:outline-none focus:ring-0"
                          />
                          <div className="flex flex-shrink-0 items-center whitespace-nowrap border-l border-surface-variant bg-surface-variant/50 px-2 text-[11px] font-semibold text-on-surface-variant">
                            = {Math.round(totalG)}g
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Macro rows */}
                    <div className="flex flex-col gap-3">
                      <MacroInputRow
                        msIcon="local_fire_department"
                        iconClass="text-primary"
                        labelClass="text-on-surface-variant"
                        label={t('meals.macros.kcal') ?? 'Kcal'}
                        unit="kcal"
                        value={it.food ? String(m.kcal) : it.kcal}
                        readOnly={!!it.food}
                        onChange={(v) => updateItem(it.uid, { kcal: v })}
                      />
                      <MacroInputRow
                        msIcon="egg_alt"
                        iconClass="text-primary"
                        labelClass="text-on-surface-variant"
                        label={t('meals.macros.protein') ?? 'Protein'}
                        unit="g"
                        value={it.food ? String(m.protein) : it.protein}
                        readOnly={!!it.food}
                        onChange={(v) => updateItem(it.uid, { protein: v })}
                      />
                      <MacroInputRow
                        msIcon="bakery_dining"
                        iconClass="text-amber-400"
                        labelClass="text-on-surface-variant"
                        label={t('meals.macros.carbs') ?? 'Carbs'}
                        unit="g"
                        value={it.food ? String(m.carbs) : it.carbs}
                        readOnly={!!it.food}
                        onChange={(v) => updateItem(it.uid, { carbs: v })}
                      />
                      <MacroInputRow
                        msIcon="opacity"
                        iconClass="text-rose-400"
                        labelClass="text-on-surface-variant"
                        label={t('meals.macros.fat') ?? 'Fat'}
                        unit="g"
                        value={it.food ? String(m.fat) : it.fat}
                        readOnly={!!it.food}
                        onChange={(v) => updateItem(it.uid, { fat: v })}
                      />
                    </div>

                    {/* Save-as-food (visible si custom + tiene macros) */}
                    {!it.food && it.customName.trim() && num(it.kcal) > 0 && (
                      <button
                        type="button"
                        disabled={saveAsFood.isPending}
                        onClick={() => saveAsFood.mutate(it.uid)}
                        className="inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-full border border-outline-variant px-3 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-50"
                      >
                        {saveAsFood.isPending && saveAsFood.variables === it.uid ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <BookmarkPlus className="h-3.5 w-3.5" />
                        )}
                        {t('meals.saveAsFood') ?? 'Guardar en mi catálogo'}
                      </button>
                    )}

                    {idx < items.length - 1 && (
                      <div className="border-b border-outline-variant/30" />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* FAB Añadir plato — encima del mic */}
        <button
          type="button"
          onClick={addItem}
          className="btn-press absolute bottom-32 right-5 z-30 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105"
          aria-label={t('meals.addItem') ?? 'Añadir producto'}
          title={t('meals.addItem') ?? 'Añadir producto'}
        >
          <Plus className="h-6 w-6" />
        </button>

        {/* Footer: mic + add button */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-surface via-surface/95 to-transparent px-5 pb-5 pt-12">
          <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-4">
            <button
              type="button"
              onClick={openVoice}
              className="btn-press grid h-14 w-14 flex-shrink-0 place-items-center rounded-full border border-surface-variant bg-surface-container-high text-primary shadow-md transition-all hover:bg-primary/10"
              aria-label={t('voice.openAria') ?? 'Asistente de voz'}
            >
              <Mic className="h-7 w-7" />
            </button>
            <button
              type="button"
              disabled={!canSubmit || save.isPending}
              onClick={() => save.mutate()}
              className="btn-press h-14 flex-grow rounded-full bg-primary-container text-base font-bold text-on-primary-container shadow-lg transition-all hover:shadow-primary/20 disabled:opacity-50"
            >
              {save.isPending ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              ) : isEdit ? (
                (t('meals.saveEdit') ?? 'Guardar cambios')
              ) : (
                (t('meals.addMealCta') ?? t('meals.add') ?? 'Añadir comida')
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Photo source sheets */}
      <PhotoSourceSheet
        open={photoSheetOpen}
        onClose={() => setPhotoSheetOpen(false)}
        title={t('meals.photo.takeOrUpload') ?? 'Añadir foto'}
        onFile={(f) => {
          setPhotoFile(f);
          setPhotoExplicitlyRemoved(false);
        }}
      />

      <PhotoSourceSheet
        open={!!itemPhotoSheetUid}
        onClose={() => setItemPhotoSheetUid(null)}
        title={t('meals.photo.analyzeItem') ?? 'Analizar ingrediente por foto'}
        onFile={(f) => {
          const uid = itemPhotoSheetUid;
          if (uid) void analyzeItemPhoto(uid, f);
        }}
      />

      {barcodeOpen && (
        <BarcodeProductFlow
          open
          onClose={() => {
            setBarcodeOpen(false);
            setBarcodeTargetUid(null);
          }}
          onSelect={(food) => {
            if (barcodeTargetUid) selectFood(barcodeTargetUid, food);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Sub-componentes ---------- */

// Mantener importación de ImageIcon para evitar tree-shake error; usado solo como referencia futura.
void ImageIcon;
