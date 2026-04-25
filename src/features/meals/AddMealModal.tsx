import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listFoods, type Food } from '@/features/foods/foods.api';
import {
  createMeal,
  removeMealPhoto,
  updateMeal,
  uploadMealPhoto,
  type Meal,
  type MealType,
} from './meals.api';
import { Alert } from '@/components/ui/Alert';

interface Props {
  date: string;
  type: MealType;
  meal?: Meal | null; // si viene → modo edición
  onClose: () => void;
}

export function AddMealModal({ date, type, meal, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = Boolean(meal);

  // Inicialización: si editamos, prellenamos con la primera entry del meal.
  const initialEntry = meal?.entries?.[0];
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  const [grams, setGrams] = useState(String(initialEntry?.grams ?? 100));
  const [customName, setCustomName] = useState(initialEntry?.customName ?? '');
  const [customKcal, setCustomKcal] = useState(
    initialEntry && !initialEntry.foodId ? String(initialEntry.kcal ?? '') : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | undefined>(meal?.photoUrl);
  const previewPhoto = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : existingPhotoUrl),
    [photoFile, existingPhotoUrl],
  );
  const fileRef = useRef<HTMLInputElement>(null);

  // Si la entry editada tenía foodId, intentamos resolverlo cargando foods (búsqueda vacía).
  const { data: foods = [] } = useQuery<Food[]>({
    queryKey: ['foods', q],
    queryFn: () => listFoods(q || undefined),
  });
  useEffect(() => {
    if (isEdit && initialEntry?.foodId && !selected) {
      const found = foods.find((f) => f._id === initialEntry.foodId);
      if (found) setSelected(found);
    }
  }, [foods, isEdit, initialEntry?.foodId, selected]);

  const previewKcal = useMemo(() => {
    if (!selected) return Number(customKcal) || 0;
    const factor = (Number(grams) || 0) / 100;
    return Math.round((selected.nutritionPer100.kcal ?? 0) * factor);
  }, [selected, grams, customKcal]);

  const save = useMutation({
    mutationFn: async () => {
      const entry = selected
        ? { foodId: selected._id, grams: Number(grams) || 0 }
        : {
            customName: customName.trim() || 'Custom',
            grams: Number(grams) || 0,
            kcal: Number(customKcal) || 0,
          };

      const result: Meal = isEdit && meal
        ? await updateMeal(meal._id, { date, type, entries: [entry] })
        : await createMeal({ date, type, entries: [entry] });

      if (photoFile) {
        try {
          await uploadMealPhoto(result._id, photoFile);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Photo upload failed');
        }
      } else if (isEdit && !existingPhotoUrl && meal?.photoUrl) {
        // El usuario quitó la foto existente.
        try {
          await removeMealPhoto(result._id);
        } catch {
          // ignored
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

  const canSubmit = selected ? Number(grams) > 0 : customName.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl bg-background p-4 shadow-lg sm:rounded-2xl">
        <header className="mb-3 flex items-center justify-between gap-2">
          <h3 className="truncate text-lg font-semibold">
            {t(`meals.types.${type}`)} · {isEdit ? t('meals.edit') : t('meals.add')}
          </h3>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground" aria-label="Close">×</button>
        </header>

        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSelected(null);
          }}
          placeholder={t('meals.searchFood') ?? 'Buscar comida'}
          className="mb-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
        />

        {!selected && q && (
          <ul className="mb-3 max-h-40 overflow-auto rounded-lg border border-border">
            {foods.length === 0 ? (
              <li className="p-2 text-xs text-muted-foreground">{t('meals.noResults')}</li>
            ) : (
              foods.slice(0, 12).map((f) => (
                <li key={f._id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(f);
                      setGrams(String(f.defaultPortionG || 100));
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className="truncate">{f.name}</span>
                    <span className="flex-shrink-0 text-xs text-muted-foreground">{Math.round(f.nutritionPer100.kcal)} kcal/100g</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}

        {selected ? (
          <div className="mb-3 rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium">{selected.name}</p>
              <button type="button" onClick={() => setSelected(null)} className="flex-shrink-0 text-xs text-muted-foreground hover:underline">
                {t('meals.changeFood')}
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{t('meals.grams')}</span>
              <input
                type="number"
                min="0"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                className="h-9 w-24 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              />
              <span className="ml-auto text-sm font-medium text-foreground">{previewKcal} kcal</span>
            </label>
          </div>
        ) : (
          <div className="mb-3 grid gap-2 rounded-lg border border-dashed border-border p-3">
            <p className="text-xs text-muted-foreground">{t('meals.orCustom')}</p>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={t('meals.customName') ?? 'Custom name'}
              className="h-10 rounded-md border border-border bg-background px-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min="0"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                placeholder="g"
                className="h-10 rounded-md border border-border bg-background px-2 text-sm"
              />
              <input
                type="number"
                min="0"
                value={customKcal}
                onChange={(e) => setCustomKcal(e.target.value)}
                placeholder="kcal"
                className="h-10 rounded-md border border-border bg-background px-2 text-sm"
              />
            </div>
          </div>
        )}

        {error && <Alert variant="error" className="mb-2">{error}</Alert>}

        {/* Foto */}
        <div className="mb-3 flex items-center gap-3">
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
              <img
                src={previewPhoto}
                alt=""
                className="h-16 w-16 rounded-lg object-cover"
              />
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
          ) : null}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="h-10 flex-1 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            {previewPhoto ? t('meals.photo.change') : t('meals.photo.add')}
          </button>
        </div>

        <button
          type="button"
          disabled={!canSubmit || save.isPending}
          onClick={() => save.mutate()}
          className="h-11 w-full rounded-full bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {save.isPending ? '…' : isEdit ? t('meals.saveEdit') : t('meals.confirm')}
        </button>
      </div>
    </div>
  );
}
