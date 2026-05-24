import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Camera,
  Loader2,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { MacroInlineStat } from '@/components/ui/MacroChips';
import { MacroInputRow } from '@/components/ui/MacroInputRow';
import { PhotoSourceSheet } from '@/components/ui/PhotoSourceSheet';
import {
  createFood,
  deleteFood,
  listFoods,
  removeFoodPhoto,
  updateFood,
  uploadFoodPhoto,
  type Food,
} from './foods.api';
import { estimateNutrition } from '@/features/ai/ai.api';
import { Alert } from '@/components/ui/Alert';
import { useConfirm } from '@/components/ui/ConfirmDialog';

interface FormState {
  name: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  defaultPortionG: string;
}

const emptyForm: FormState = {
  name: '',
  kcal: '',
  protein: '',
  carbs: '',
  fat: '',
  defaultPortionG: '100',
};

function fromFood(f: Food): FormState {
  return {
    name: f.name,
    kcal: String(f.nutritionPer100.kcal ?? ''),
    protein: String(f.nutritionPer100.protein ?? ''),
    carbs: String(f.nutritionPer100.carbs ?? ''),
    fat: String(f.nutritionPer100.fat ?? ''),
    defaultPortionG: String(f.defaultPortionG ?? 100),
  };
}

export function FoodsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoExistingUrl, setPhotoExistingUrl] = useState<string | undefined>(undefined);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<'name' | 'photo' | null>(null);

  const previewPhoto = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : photoExistingUrl),
    [photoFile, photoExistingUrl],
  );

  const { data: foods = [], isLoading } = useQuery<Food[]>({
    queryKey: ['foods', q],
    queryFn: () => listFoods(q || undefined),
  });

  const resetForm = () => {
    setForm(emptyForm);
    setShowForm(false);
    setEditingId(null);
    setPhotoFile(null);
    setPhotoExistingUrl(undefined);
    setError(null);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        defaultPortionG: Number(form.defaultPortionG) || 100,
        nutritionPer100: {
          kcal: Number(form.kcal) || 0,
          protein: Number(form.protein) || 0,
          carbs: Number(form.carbs) || 0,
          fat: Number(form.fat) || 0,
        },
      };
      const saved = editingId ? await updateFood(editingId, body) : await createFood(body);
      if (photoFile) {
        try {
          await uploadFoodPhoto(saved._id, photoFile);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Photo upload failed');
        }
      } else if (editingId && photoExistingUrl === undefined) {
        // Era una edición y el usuario quitó la foto previa.
        const prev = foods.find((f) => f._id === editingId)?.imageUrl;
        if (prev) {
          try {
            await removeFoodPhoto(saved._id);
          } catch {
            // ignored
          }
        }
      }
      return saved;
    },
    onSuccess: () => {
      resetForm();
      qc.invalidateQueries({ queryKey: ['foods'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFood(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['foods'] }),
  });

  const onEdit = (f: Food) => {
    setEditingId(f._id);
    setForm(fromFood(f));
    setPhotoExistingUrl(f.imageUrl);
    setPhotoFile(null);
    setShowForm(true);
    setError(null);
  };

  const aiFill = async (mode: 'name' | 'photo') => {
    if (mode === 'name' && !form.name.trim()) return;
    if (mode === 'photo' && !photoFile) return;
    setAiBusy(mode);
    setError(null);
    try {
      // weightG=100 → los valores devueltos están por 100g.
      const result = await estimateNutrition({
        image: mode === 'photo' ? photoFile ?? undefined : undefined,
        name: form.name.trim() || undefined,
        weightG: 100,
        locale: i18n.language,
      });
      setForm((prev) => ({
        ...prev,
        name: prev.name.trim() ? prev.name : result.name ?? prev.name,
        kcal: result.kcal != null ? String(Math.round(result.kcal)) : prev.kcal,
        protein: result.proteinG != null ? String(Math.round(result.proteinG * 10) / 10) : prev.protein,
        carbs: result.carbsG != null ? String(Math.round(result.carbsG * 10) / 10) : prev.carbs,
        fat: result.fatG != null ? String(Math.round(result.fatG * 10) / 10) : prev.fat,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI failed');
    } finally {
      setAiBusy(null);
    }
  };

  return (
    <div className="w-full overflow-hidden">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{t('foods.title')}</h2>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="h-10 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          + {t('foods.add')}
        </button>
      </header>

      <div className="mb-4 flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container px-4 py-1">
        <Search className="h-5 w-5 flex-shrink-0 text-on-surface-variant" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('foods.search') ?? 'Search'}
          className="h-12 w-full flex-1 bg-transparent text-sm text-on-background placeholder:text-on-surface-variant focus:outline-none"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-high"
            aria-label={t('common.clear') ?? 'Clear'}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) resetForm();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-surface shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:max-w-md sm:rounded-2xl sm:border sm:border-outline-variant"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <header className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-surface/95 px-5 py-4 backdrop-blur-md">
              <button
                type="button"
                onClick={resetForm}
                className="grid h-10 w-10 place-items-center rounded-full border border-surface-variant bg-surface-container text-on-surface-variant transition-colors hover:text-primary"
                aria-label={t('common.close') ?? 'Close'}
              >
                <X className="h-5 w-5" />
              </button>
              <h1 className="text-lg font-bold text-on-background">
                {editingId ? t('foods.editTitle') : t('foods.addTitle')}
              </h1>
              <div className="w-10" />
            </header>

            <form
              id="food-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.name.trim()) return;
                saveMut.mutate();
              }}
              className="flex-1 space-y-4 overflow-y-auto px-5 pb-32 pt-2"
            >
              {error && <Alert variant="error">{error}</Alert>}

              {/* Photo card */}
              {previewPhoto ? (
                <div className="ai-glow relative overflow-hidden rounded-xl">
                  <img src={previewPhoto} alt="" className="aspect-video w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <button
                      type="button"
                      onClick={() => setPhotoSheetOpen(true)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-container/90 px-3 text-xs font-semibold text-on-surface backdrop-blur hover:bg-surface-container-high"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      {t('foods.photo.change')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFile(null);
                        setPhotoExistingUrl(undefined);
                      }}
                      className="grid h-9 w-9 place-items-center rounded-full bg-surface-container/90 text-on-surface backdrop-blur hover:bg-surface-container-high"
                      aria-label={t('foods.photo.remove') ?? 'Remove'}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPhotoSheetOpen(true)}
                  className="ai-glow group glass-panel relative flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl p-4"
                >
                  <div className="z-10 grid h-12 w-12 place-items-center rounded-full bg-surface-container transition-transform group-hover:scale-105">
                    <Camera className="h-5 w-5 text-primary" />
                  </div>
                  <span className="z-10 text-sm font-semibold text-primary">
                    {t('foods.photo.add') ?? 'Add photo'}
                  </span>
                </button>
              )}

              {/* Name + macros card */}
              <div className="space-y-5 rounded-xl border border-surface-variant bg-surface-container-low p-5">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {t('foods.fields.name')}
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t('foods.fields.name') ?? 'Name'}
                    required
                    className="h-10 rounded-lg border border-surface-variant bg-surface-container-low px-3 text-sm text-on-background focus:border-primary focus:outline-none"
                  />
                </div>

                <p className="text-[11px] text-on-surface-variant">
                  {t('foods.per100Hint')}
                </p>

                {/* AI pills */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={aiBusy !== null || !form.name.trim()}
                    onClick={() => aiFill('name')}
                    title={!form.name.trim() ? (t('foods.ai.needsName') ?? '') : undefined}
                    className="inline-flex h-8 items-center gap-1 rounded-full bg-primary/10 px-3 text-[11px] font-semibold text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {aiBusy === 'name' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {t('foods.ai.fromName')}
                  </button>
                  <button
                    type="button"
                    disabled={aiBusy !== null || !photoFile}
                    onClick={() => aiFill('photo')}
                    title={!photoFile ? (t('foods.ai.needsPhoto') ?? '') : undefined}
                    className="inline-flex h-8 items-center gap-1 rounded-full bg-primary/10 px-3 text-[11px] font-semibold text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {aiBusy === 'photo' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {t('foods.ai.fromPhoto')}
                  </button>
                </div>

                {/* Macros rows */}
                <div className="flex flex-col gap-3">
                  <MacroInputRow
                    msIcon="local_fire_department"
                    iconClass="text-primary"
                    label={t('foods.fields.kcal100')}
                    unit="kcal"
                    value={form.kcal}
                    onChange={(v) => setForm({ ...form, kcal: v })}
                  />
                  <MacroInputRow
                    msIcon="egg_alt"
                    iconClass="text-primary"
                    label={t('foods.fields.protein')}
                    unit="g"
                    value={form.protein}
                    onChange={(v) => setForm({ ...form, protein: v })}
                  />
                  <MacroInputRow
                    msIcon="bakery_dining"
                    iconClass="text-amber-400"
                    label={t('foods.fields.carbs')}
                    unit="g"
                    value={form.carbs}
                    onChange={(v) => setForm({ ...form, carbs: v })}
                  />
                  <MacroInputRow
                    msIcon="opacity"
                    iconClass="text-rose-400"
                    label={t('foods.fields.fat')}
                    unit="g"
                    value={form.fat}
                    onChange={(v) => setForm({ ...form, fat: v })}
                  />
                  <MacroInputRow
                    msIcon="scale"
                    iconClass="text-on-surface-variant"
                    label={t('foods.fields.portion')}
                    unit="g"
                    value={form.defaultPortionG}
                    onChange={(v) => setForm({ ...form, defaultPortionG: v })}
                  />
                </div>
              </div>
            </form>

            {/* Footer fijo */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-surface via-surface/95 to-transparent px-5 pb-5 pt-12">
              <div className="pointer-events-auto mx-auto max-w-md">
                <button
                  type="submit"
                  form="food-form"
                  disabled={saveMut.isPending || !form.name.trim()}
                  className="btn-press h-14 w-full rounded-full bg-primary-container text-base font-bold text-on-primary-container shadow-lg transition-all hover:shadow-primary/20 disabled:opacity-50"
                >
                  {saveMut.isPending ? (
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  ) : editingId ? (
                    t('foods.saveEdit')
                  ) : (
                    t('foods.save')
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : foods.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('foods.empty')}</p>
      ) : (
        <ul className="grid gap-2">
          {foods.map((f) => (
            <li
              key={f._id}
              className="flex min-w-0 items-center gap-3 rounded-xl bg-surface-container-low px-3 py-2.5"
            >
              {f.imageUrl ? (
                <img src={f.imageUrl} alt="" className="h-14 w-14 flex-shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-lg bg-surface-container text-base">
                  🥗
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold leading-snug text-on-background line-clamp-2">
                  {f.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <MacroInlineStat macro="kcal" value={f.nutritionPer100.kcal} unit="kcal/100g" />
                  <MacroInlineStat macro="protein" value={f.nutritionPer100.protein} />
                  <MacroInlineStat macro="carbs" value={f.nutritionPer100.carbs} />
                  <MacroInlineStat macro="fat" value={f.nutritionPer100.fat} />
                </div>
              </div>
              {f.userId && (
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(f)}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={t('foods.edit')}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({
                        title: t('common.deleteConfirmTitle'),
                        description: t('foods.deleteConfirm', { defaultValue: t('common.deleteConfirmDesc') }),
                        destructive: true,
                        confirmText: t('common.delete'),
                      });
                      if (ok) deleteMut.mutate(f._id);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full text-destructive hover:bg-destructive/10"
                    aria-label={t('foods.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <PhotoSourceSheet
        open={photoSheetOpen}
        onClose={() => setPhotoSheetOpen(false)}
        onFile={(f) => setPhotoFile(f)}
      />
    </div>
  );
}
