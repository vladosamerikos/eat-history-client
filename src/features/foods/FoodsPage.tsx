import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Loader2, Pencil, Sparkles, Trash2 } from 'lucide-react';
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
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoExistingUrl, setPhotoExistingUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<'name' | 'photo' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (fileRef.current) fileRef.current.value = '';
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
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="h-10 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {showForm ? t('foods.cancel') : `+ ${t('foods.add')}`}
        </button>
      </header>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('foods.search') ?? 'Search'}
        className="mb-4 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
      />

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim()) return;
            saveMut.mutate();
          }}
          className="mb-4 grid gap-2 rounded-2xl border border-border p-4"
        >
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t('foods.fields.name') ?? 'Name'}
            required
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          />

          <p className="-mt-1 text-[11px] text-muted-foreground">
            {t('foods.per100Hint') ?? 'Los macros son por 100g. La porción se usa solo como cantidad por defecto al registrar.'}
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <NumField label={t('foods.fields.kcal100')} value={form.kcal} onChange={(v) => setForm({ ...form, kcal: v })} />
            <NumField label={t('foods.fields.protein')} value={form.protein} onChange={(v) => setForm({ ...form, protein: v })} />
            <NumField label={t('foods.fields.carbs')} value={form.carbs} onChange={(v) => setForm({ ...form, carbs: v })} />
            <NumField label={t('foods.fields.fat')} value={form.fat} onChange={(v) => setForm({ ...form, fat: v })} />
            <NumField label={t('foods.fields.portion')} value={form.defaultPortionG} onChange={(v) => setForm({ ...form, defaultPortionG: v })} />
          </div>

          {/* Foto */}
          <div className="flex items-center gap-3">
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
                    setPhotoExistingUrl(undefined);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                  className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-destructive text-xs text-white"
                  aria-label={t('foods.photo.remove')}
                >
                  ×
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-10 flex-1 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                <Camera className="h-4 w-4" />
                {previewPhoto ? t('foods.photo.change') : t('foods.photo.add')}
              </span>
            </button>
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={aiBusy !== null || !form.name.trim()}
              onClick={() => aiFill('name')}
              title={!form.name.trim() ? (t('foods.ai.needsName') ?? 'Escribe el nombre primero') : undefined}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-primary/10 px-3 text-[11px] font-medium text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary/20"
            >
              {aiBusy === 'name' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {t('foods.ai.fromName') ?? 'IA desde nombre'}
            </button>
            <button
              type="button"
              disabled={aiBusy !== null || !photoFile}
              onClick={() => aiFill('photo')}
              title={!photoFile ? (t('foods.ai.needsPhoto') ?? 'Añade una foto primero') : undefined}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-primary/10 px-3 text-[11px] font-medium text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary/20"
            >
              {aiBusy === 'photo' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {t('foods.ai.fromPhoto') ?? 'IA desde foto'}
            </button>
          </div>

          <button
            type="submit"
            disabled={saveMut.isPending}
            className="h-10 rounded-full bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saveMut.isPending ? '…' : editingId ? t('foods.saveEdit') : t('foods.save')}
          </button>
        </form>
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
              className="flex min-w-0 items-center gap-3 rounded-xl border border-border px-3 py-2"
            >
              {f.imageUrl ? (
                <img src={f.imageUrl} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-lg bg-muted text-base">
                  🥗
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {Math.round(f.nutritionPer100.kcal)} kcal/100g · P{Math.round(f.nutritionPer100.protein)} · C{Math.round(f.nutritionPer100.carbs)} · G{Math.round(f.nutritionPer100.fat)}
                </p>
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
                    onClick={() => {
                      if (window.confirm(t('foods.deleteConfirm', { defaultValue: t('foods.delete') + '?' }))) {
                        deleteMut.mutate(f._id);
                      }
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
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
      />
    </label>
  );
}
