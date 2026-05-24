import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { listFoods, type Food } from '@/features/foods/foods.api';

interface Props {
  /** Texto actual visible en el input (puede ser custom o nombre del Food). */
  value: string;
  /** Food asociado si ya hay uno seleccionado, para mostrar thumbnail/badge. */
  food?: Food | null;
  /** Llamado mientras el usuario escribe libre (custom name). */
  onTextChange: (text: string) => void;
  /** Llamado al elegir un Food del catálogo. */
  onPickFood: (food: Food) => void;
  /** Quitar el Food asociado pero conservar texto (volver a custom). */
  onClearFood?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Slot opcional alineado a la derecha del input (p.ej. botón sparkle). */
  actionSlot?: ReactNode;
}

/**
 * Input combinado de búsqueda + customName.
 * - Escribir filtra el catálogo y muestra un dropdown con resultados.
 * - Al elegir un Food, se sincroniza el texto y se emite `onPickFood`.
 * - Si no hay match exacto, el texto queda como customName.
 */
export function FoodCombobox({
  value,
  food,
  onTextChange,
  onPickFood,
  onClearFood,
  placeholder,
  autoFocus,
  actionSlot,
}: Props) {
  const { t } = useTranslation();
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setQ(value);
  }, [value]);

  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Debounced query
  const [dq, setDq] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDq(q.trim()), 180);
    return () => clearTimeout(id);
  }, [q]);

  const { data: foods = [], isFetching } = useQuery<Food[]>({
    queryKey: ['foods', 'combobox', dq],
    queryFn: () => listFoods(dq || undefined),
    enabled: open,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    if (!dq) return foods.slice(0, 8);
    const lq = dq.toLowerCase();
    return foods.filter((f) => f.name.toLowerCase().includes(lq)).slice(0, 8);
  }, [foods, dq]);

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={`flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 transition focus-within:border-primary focus-within:ring-1 focus-within:ring-primary ${
          food ? 'pl-2' : ''
        }`}
      >
        {food?.imageUrl ? (
          <img
            src={food.imageUrl}
            alt=""
            className="h-7 w-7 flex-shrink-0 rounded-md object-cover"
          />
        ) : (
          <Search className="h-4 w-4 flex-shrink-0 text-on-surface-variant" />
        )}
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => {
            const next = e.target.value;
            setQ(next);
            onTextChange(next);
            if (food && next !== food.name) onClearFood?.();
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? (t('meals.pickOrType') ?? 'Elegir comida o escribir')}
          className="h-7 flex-1 bg-transparent text-sm text-on-background placeholder:text-on-surface-variant/50 focus:outline-none"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              onTextChange('');
              onClearFood?.();
              inputRef.current?.focus();
            }}
            className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-high"
            aria-label={t('common.clear') ?? 'Limpiar'}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {actionSlot}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-40 max-h-72 overflow-y-auto rounded-xl border border-outline-variant bg-surface-container shadow-2xl">
          {isFetching && filtered.length === 0 ? (
            <p className="px-3 py-3 text-xs text-on-surface-variant">
              {t('common.loading') ?? 'Cargando…'}
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-3 text-xs text-on-surface-variant">
              {q.trim()
                ? (t('meals.useCustom', { name: q.trim() }) ??
                  `Usar "${q.trim()}" como entrada personalizada`)
                : (t('common.empty') ?? 'Sin resultados')}
            </p>
          ) : (
            <ul className="p-1">
              {filtered.map((f) => (
                <li key={f._id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPickFood(f);
                      setQ(f.name);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high"
                  >
                    {f.imageUrl ? (
                      <img
                        src={f.imageUrl}
                        alt=""
                        className="h-9 w-9 flex-shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-md bg-surface-container-high text-base">
                        🥗
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{f.name}</p>
                      <p className="truncate text-[10px] text-on-surface-variant">
                        {Math.round(f.nutritionPer100.kcal)} kcal/100g · P
                        {Math.round(f.nutritionPer100.protein)} · C
                        {Math.round(f.nutritionPer100.carbs)} · G
                        {Math.round(f.nutritionPer100.fat)}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-[10px] uppercase text-on-surface-variant">
                      {f.defaultPortionG ?? 100}g
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
