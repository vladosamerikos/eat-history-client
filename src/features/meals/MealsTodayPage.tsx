import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Coffee,
  Cookie,
  Flame,
  MessageCircle,
  Moon,
  Pencil,
  Plus,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import {
  deleteMeal,
  listMeals,
  dailySummary,
  todayISO,
  MEAL_TYPES,
  type DailySummary,
  type Meal,
  type MealType,
} from './meals.api';
import { listFoods, type Food } from '@/features/foods/foods.api';
import { AddMealModal } from './AddMealModal';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { MacroBadges, MacroTiles } from '@/components/ui/MacroBadges';
import { toast } from 'sonner';

// IMPORTANTE: aritmética en UTC para evitar el bug de TZ.
// `new Date('YYYY-MM-DDT00:00:00')` se parsea como hora local, pero
// `toISOString()` la devuelve en UTC. En timezones con offset positivo
// (p.ej. Europe/Madrid +2) eso provocaba que addDays(-1) saltara 2 días
// y addDays(+1) no cambiara de día. Resolvemos parseando y operando en UTC.
function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function isoDiffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const da = Date.UTC(ay, (am || 1) - 1, ad || 1);
  const db = Date.UTC(by, (bm || 1) - 1, bd || 1);
  return Math.round((da - db) / 86_400_000);
}

const TYPE_ICON: Record<MealType, typeof Coffee> = {
  breakfast: Coffee,
  lunch: UtensilsCrossed,
  snack: Cookie,
  dinner: Moon,
};

interface DateStripProps {
  selected: string;
  onSelect: (date: string) => void;
  locale: string;
}

function DateStrip({ selected, onSelect, locale }: DateStripProps) {
  const today = todayISO();
  const days = useMemo(
    () => Array.from({ length: 15 }, (_, i) => addDays(selected, i - 7)),
    [selected],
  );
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selected]);

  const fmtWeekday = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short' }),
    [locale],
  );

  return (
    <div className="relative">
      <div
        className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-3 no-scrollbar"
        style={{ touchAction: 'pan-x' }}
      >
        {days.map((d) => {
          const dt = new Date(`${d}T00:00:00`);
          const isSelected = d === selected;
          const isToday = d === today;
          return (
            <button
              key={d}
              ref={isSelected ? selectedRef : undefined}
              type="button"
              onClick={() => onSelect(d)}
              className={`flex h-16 min-w-[3.5rem] flex-shrink-0 snap-center flex-col items-center justify-center rounded-xl text-xs transition ${
                isSelected
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className={`text-[10px] uppercase tracking-wider ${isSelected ? 'opacity-90' : ''}`}>
                {fmtWeekday.format(dt)}
              </span>
              <span className={`text-xl font-bold leading-none ${isSelected ? '' : 'text-on-background'}`}>
                {dt.getDate()}
              </span>
              {isToday && !isSelected && (
                <span className="mt-0.5 h-1 w-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-surface-container">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{
            width: `${((days.findIndex((d) => d === selected) + 1) / days.length) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}

export function MealsTodayPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [date, setDate] = useState(todayISO());
  const [adding, setAdding] = useState<MealType | null>(null);
  const [editing, setEditing] = useState<Meal | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  const meals = useQuery<Meal[]>({
    queryKey: ['meals', date],
    queryFn: () => listMeals(date),
  });
  // Catálogo en caché para resolver imageUrl de cada entry sin pegar al BE.
  const foodsQ = useQuery<Food[]>({
    queryKey: ['foods'],
    queryFn: () => listFoods(),
    staleTime: 60_000,
  });
  const foodById = useMemo(() => {
    const m = new Map<string, Food>();
    (foodsQ.data ?? []).forEach((f) => m.set(f._id, f));
    return m;
  }, [foodsQ.data]);
  const summary = useQuery<DailySummary>({
    queryKey: ['summary', date],
    queryFn: () => dailySummary(date),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteMeal(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meals', date] });
      qc.invalidateQueries({ queryKey: ['summary', date] });
      toast.success(t('common.saved'));
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : t('common.errorGeneric'));
    },
  });

  const grouped = MEAL_TYPES.map((type) => ({
    type,
    items: (meals.data ?? []).filter((m) => m.type === type),
  }));

  const headerLabel = useMemo(() => {
    const today = todayISO();
    const diff = isoDiffDays(date, today);
    if (diff === 0) return t('meals.todayLabel');
    if (diff === -1) return t('meals.yesterday');
    if (diff === 1) return t('meals.tomorrow');
    return new Intl.DateTimeFormat(i18n.language, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(`${date}T00:00:00`));
  }, [date, t, i18n.language]);

  // Swipe nativo con touch events + drag visual.
  // Bug detectado: usar `changedTouches[0]` y `addDays(date, ...)` con closure
  // estable provocaba dx=0 (en algunos móviles) y stale-date (skip 1 día).
  // Solución: trackear el último clientX/Y de touchmove + functional updater.
  // Además usamos changedTouches[0] en touchend porque en swipes muy rápidos
  // touchmove puede no dispararse y dx quedaba a 0 (bug der→izq).
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isSwiping = useRef(false);
  const isLocked = useRef(false); // bloqueo durante animación para evitar saltos dobles
  const [dragX, setDragX] = useState(0);
  const [swipeDir, setSwipeDir] = useState<1 | -1>(1); // 1 = avanza día (entra desde derecha)
  const SWIPE_THRESHOLD = 50;

  const goNext = () => {
    if (isLocked.current) return;
    isLocked.current = true;
    window.setTimeout(() => {
      isLocked.current = false;
    }, 350);
    setSwipeDir(1);
    setDate((d) => addDays(d, 1));
  };
  const goPrev = () => {
    if (isLocked.current) return;
    isLocked.current = true;
    window.setTimeout(() => {
      isLocked.current = false;
    }, 350);
    setSwipeDir(-1);
    setDate((d) => addDays(d, -1));
  };

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isLocked.current) return;
    const t0 = e.touches[0];
    if (!t0) return;
    touchStart.current = { x: t0.clientX, y: t0.clientY, t: Date.now() };
    lastPos.current = { x: t0.clientX, y: t0.clientY };
    isSwiping.current = false;
  };
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    if (!start) return;
    const t0 = e.touches[0];
    if (!t0) return;
    lastPos.current = { x: t0.clientX, y: t0.clientY };
    const dx = t0.clientX - start.x;
    const dy = t0.clientY - start.y;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      isSwiping.current = true;
      const damped = Math.sign(dx) * Math.min(Math.abs(dx), 120);
      setDragX(damped);
    }
  };
  const finishSwipe = (endX: number, endY: number) => {
    const start = touchStart.current;
    touchStart.current = null;
    setDragX(0);
    if (!start) return;
    const dx = endX - start.x;
    const dy = endY - start.y;
    const dt = Date.now() - start.t;
    isSwiping.current = false;
    if (dt > 800) return;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) goNext();
    else goPrev();
  };
  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    // Usar changedTouches[0] porque touches está vacío al lift, y en swipes
    // rápidos puede que no haya touchmove (lastPos == start).
    const c = e.changedTouches[0];
    if (c) finishSwipe(c.clientX, c.clientY);
    else finishSwipe(lastPos.current.x, lastPos.current.y);
  };
  const onTouchCancel = () => {
    touchStart.current = null;
    isSwiping.current = false;
    setDragX(0);
  };

  const macroLabels = {
    protein: t('meals.macros.protein') ?? 'Protein',
    carbs: t('meals.macros.carbs') ?? 'Carbs',
    fat: t('meals.macros.fat') ?? 'Fat',
  };

  return (
    <div className="w-full overflow-x-hidden">
      <header className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={goPrev}
          className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-surface-container text-on-surface-variant transition-colors hover:text-on-background"
          aria-label={t('meals.yesterday')}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h2 className="truncate text-xl font-bold capitalize text-on-background">{headerLabel}</h2>
          <button
            type="button"
            onClick={() => setDate(todayISO())}
            className="text-[11px] tabular-nums text-on-surface-variant underline-offset-2 hover:underline"
          >
            {date}
          </button>
        </div>
        <button
          type="button"
          onClick={goNext}
          className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-surface-container text-on-surface-variant transition-colors hover:text-on-background"
          aria-label={t('meals.tomorrow')}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </header>

      <DateStrip selected={date} onSelect={setDate} locale={i18n.language} />

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        style={{ touchAction: 'pan-y' }}
        className="relative"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={date}
            initial={{ opacity: 0, x: swipeDir * 60 }}
            animate={{ opacity: 1, x: dragX }}
            exit={{ opacity: 0, x: swipeDir * -60 }}
            transition={{
              x: dragX !== 0 ? { type: 'tween', duration: 0 } : { type: 'spring', stiffness: 380, damping: 32 },
              opacity: { duration: 0.18 },
            }}
          >
            {/* Daily Summary */}
            <section className="my-4">
              <div className="ai-glow glass-panel relative overflow-hidden rounded-xl p-4">
                <div className="mb-6 flex items-end justify-between gap-3">
                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      {t('meals.dailyTotal')}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl bg-primary/10">
                        <Flame className="h-7 w-7 text-primary" />
                      </span>
                      <div className="flex flex-col">
                        <span className="text-[40px] font-bold leading-none tabular-nums text-on-background">
                          {summary.data?.totalKcal ?? 0}
                        </span>
                        <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                          kcal
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/app/chat?date=${date}`)}
                    className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-surface-bright text-primary hover:bg-surface-container-highest"
                    aria-label={t('chat.openDayChat')}
                    title={t('chat.openDayChat')}
                  >
                    <MessageCircle className="h-5 w-5" />
                  </button>
                </div>
                <MacroTiles
                  protein={summary.data?.totalProtein ?? 0}
                  carbs={summary.data?.totalCarbs ?? 0}
                  fat={summary.data?.totalFat ?? 0}
                  labels={macroLabels}
                />
              </div>
            </section>

            {/* Meal type sections */}
            <div className="grid gap-3">
              {grouped.map(({ type, items }) => {
                const TypeIcon = TYPE_ICON[type];
                const sectionKcal = items.reduce((sum, m) => sum + m.totalKcal, 0);
                return (
                  <section
                    key={type}
                    className="overflow-hidden rounded-xl border border-outline-variant bg-surface"
                  >
                    <header className="flex items-center justify-between gap-2 border-b border-outline-variant/40 bg-surface-container-low px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-surface-container-high text-primary">
                          <TypeIcon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-bold text-on-background">
                            {t(`meals.types.${type}`)}
                          </h3>
                          {sectionKcal > 0 && (
                            <p className="text-[11px] font-semibold tabular-nums text-on-surface-variant">
                              {sectionKcal} kcal
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAdding(type)}
                        className="btn-press inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full bg-primary-container px-4 text-xs font-bold text-on-primary-container shadow-sm transition-all"
                      >
                        <Plus className="h-4 w-4" />
                        <span>{t('meals.add')}</span>
                      </button>
                    </header>
                    {items.length === 0 ? (
                      <p className="px-4 py-4 text-xs text-on-surface-variant">
                        {t('meals.noMeals')}
                      </p>
                    ) : (
                      <ul className="grid gap-2 p-3">
                        {items.map((m) => {
                          const entryFoods = m.entries
                            .map((e) => (e.foodId ? foodById.get(String(e.foodId)) : null))
                            .filter(Boolean) as Food[];
                          const singleFoodImage =
                            !m.photoUrl && m.entries.length === 1 && entryFoods[0]?.imageUrl
                              ? entryFoods[0].imageUrl
                              : null;
                          const mosaicFoods = !m.photoUrl && !singleFoodImage
                            ? entryFoods.filter((f) => f?.imageUrl).slice(0, 4)
                            : [];
                          const name = m.entries
                            .map((e) => {
                              const f = e.foodId ? foodById.get(String(e.foodId)) : null;
                              return e.customName ?? f?.name ?? `Food (${e.grams}g)`;
                            })
                            .join(' · ');
                          const mealTotals = m.entries.reduce(
                            (acc, e) => ({
                              protein: acc.protein + (e.protein ?? 0),
                              carbs: acc.carbs + (e.carbs ?? 0),
                              fat: acc.fat + (e.fat ?? 0),
                            }),
                            { protein: 0, carbs: 0, fat: 0 },
                          );
                          return (
                            <li
                              key={m._id}
                              className="flex items-center gap-3 rounded-lg bg-surface-container-low p-3"
                            >
                              {m.photoUrl ? (
                                <img
                                  src={m.photoUrl}
                                  alt=""
                                  loading="lazy"
                                  onClick={() => setViewingPhoto(m.photoUrl ?? null)}
                                  className="h-12 w-12 flex-shrink-0 cursor-zoom-in rounded-lg object-cover transition-transform active:scale-95"
                                />
                              ) : singleFoodImage ? (
                                <img
                                  src={singleFoodImage}
                                  alt=""
                                  loading="lazy"
                                  onClick={() => setViewingPhoto(singleFoodImage)}
                                  className="h-12 w-12 flex-shrink-0 cursor-zoom-in rounded-lg object-cover transition-transform active:scale-95"
                                />
                              ) : mosaicFoods.length > 1 ? (
                                <div className="grid h-12 w-12 flex-shrink-0 grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-lg bg-surface">
                                  {mosaicFoods.slice(0, 4).map((f, i) => (
                                    <img
                                      key={(f._id || '') + i}
                                      src={f.imageUrl!}
                                      alt=""
                                      loading="lazy"
                                      className="h-full w-full object-cover"
                                    />
                                  ))}
                                  {Array.from({ length: Math.max(0, 4 - mosaicFoods.length) }).map((_, i) => (
                                    <span key={`pad-${i}`} className="bg-surface-container" />
                                  ))}
                                </div>
                              ) : (
                                <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-lg bg-surface-container text-on-surface-variant">
                                  <UtensilsCrossed className="h-5 w-5" />
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-on-background">{name}</p>
                                <div className="mt-1">
                                  <MacroBadges
                                    kcal={m.totalKcal}
                                    protein={mealTotals.protein}
                                    carbs={mealTotals.carbs}
                                    fat={mealTotals.fat}
                                    labels={{
                                      protein: t('meals.macros.proteinShort') ?? 'P',
                                      carbs: t('meals.macros.carbsShort') ?? 'C',
                                      fat: t('meals.macros.fatShort') ?? 'G',
                                    }}
                                    compact
                                  />
                                </div>
                              </div>
                              <div className="flex flex-shrink-0 flex-col items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setEditing(m)}
                                  className="grid h-8 w-8 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-background"
                                  aria-label={t('meals.edit')}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const ok = await confirm({
                                      title: t('common.deleteConfirmTitle'),
                                      description: t('meals.deleteConfirm'),
                                      destructive: true,
                                      confirmText: t('common.delete'),
                                    });
                                    if (ok) del.mutate(m._id);
                                  }}
                                  className="grid h-8 w-8 place-items-center rounded-full text-destructive hover:bg-destructive/10"
                                  aria-label={t('meals.remove')}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>

            <p className="mt-4 text-center text-[11px] text-on-surface-variant">
              {t('meals.swipeHint')}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {adding && <AddMealModal date={date} type={adding} onClose={() => setAdding(null)} />}
      {editing && (
        <AddMealModal
          date={editing.date}
          type={editing.type}
          meal={editing}
          onClose={() => setEditing(null)}
        />
      )}
      <PhotoViewer src={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </div>
  );
}
