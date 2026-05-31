import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Loader2, Scale, UtensilsCrossed } from 'lucide-react';
import { getAgentEvents, type AgentEvent } from './chat.api';
import { listMeals, type Meal, type MealType } from '@/features/meals/meals.api';
import { listWeights, type Weight } from '@/features/weights/weights.api';
import { AddMealModal } from '@/features/meals/AddMealModal';
import { AddWeightModal } from '@/features/weights/AddWeightModal';
import { MacroInlineStat } from '@/components/ui/MacroChips';

/**
 * Polling de los eventos del agente (comida/peso añadidos o modificados via
 * MCP en modo voz o chat). Acumula los eventos deduplicados por id.
 *
 * @param active si false, no hace polling (p.ej. drawer/chat cerrado).
 */
export function useAgentEventCards(active: boolean): { events: AgentEvent[]; clear: () => void } {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const sinceRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!active) return;
    let stop = false;
    const tick = async (): Promise<void> => {
      try {
        const fresh = await getAgentEvents(sinceRef.current);
        if (stop || fresh.length === 0) return;
        sinceRef.current = Math.max(sinceRef.current, ...fresh.map((e) => e.at));
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => e.id));
          const merged = [...prev];
          for (const e of fresh) if (!seen.has(e.id)) merged.push(e);
          return merged;
        });
      } catch {
        // silencioso: el polling reintenta
      }
    };
    void tick();
    const iv = window.setInterval(() => void tick(), 2500);
    return () => {
      stop = true;
      window.clearInterval(iv);
    };
  }, [active]);

  return { events, clear: () => setEvents([]) };
}

/** Lista vertical de cards para los eventos del agente. */
export function AgentEventCards({ events }: { events: AgentEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="space-y-2">
      {events.map((ev) =>
        ev.kind === 'meal' ? (
          <MealEventCard key={ev.id} event={ev} />
        ) : (
          <WeightEventCard key={ev.id} event={ev} />
        ),
      )}
    </div>
  );
}

function CardShell({
  icon,
  title,
  subtitle,
  children,
  onClick,
  loading,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || !onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card/60 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-70"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        {children ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">{children}</div>
        ) : null}
      </div>
      {onClick ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
    </button>
  );
}

function MealEventCard({ event }: { event: AgentEvent }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const mealsQ = useQuery({
    queryKey: ['meals', event.date],
    queryFn: () => listMeals(event.date),
  });
  const meal: Meal | undefined = useMemo(
    () => mealsQ.data?.find((m) => m._id === event.refId),
    [mealsQ.data, event.refId],
  );

  const type = (meal?.type ?? (event.mealType as MealType | undefined) ?? 'lunch') as MealType;
  const typeLabel = t(`meals.types.${type}`);
  const names = meal?.entries
    ?.map((e) => e.customName ?? '')
    .filter(Boolean)
    .join(', ');
  const totals = meal?.entries?.reduce(
    (acc, e) => ({
      kcal: acc.kcal + (e.kcal ?? 0),
      protein: acc.protein + (e.protein ?? 0),
      carbs: acc.carbs + (e.carbs ?? 0),
      fat: acc.fat + (e.fat ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return (
    <>
      <CardShell
        icon={<UtensilsCrossed className="h-5 w-5" />}
        title={`${typeLabel} · ${event.date}`}
        subtitle={names || undefined}
        loading={mealsQ.isLoading && !meal}
        onClick={meal ? () => setEditing(true) : undefined}
      >
        {totals && meal ? (
          <>
            <MacroInlineStat macro="kcal" value={meal.totalKcal} unit="kcal" />
            <MacroInlineStat macro="protein" value={totals.protein} />
            <MacroInlineStat macro="carbs" value={totals.carbs} />
            <MacroInlineStat macro="fat" value={totals.fat} />
          </>
        ) : null}
      </CardShell>
      {editing && meal
        ? createPortal(
            <AddMealModal
              date={meal.date}
              type={meal.type}
              meal={meal}
              onClose={() => {
                setEditing(false);
                qc.invalidateQueries({ queryKey: ['meals'] });
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function WeightEventCard({ event }: { event: AgentEvent }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const weightsQ = useQuery({
    queryKey: ['weights', 'recent', 100],
    queryFn: () => listWeights({ limit: 100 }),
  });
  const weight: Weight | undefined = useMemo(
    () => weightsQ.data?.find((w) => w._id === event.refId),
    [weightsQ.data, event.refId],
  );

  return (
    <>
      <CardShell
        icon={<Scale className="h-5 w-5" />}
        title={weight ? `${weight.kg} kg` : t('weight.title')}
        subtitle={`${t('weight.title')} · ${event.date}`}
        loading={weightsQ.isLoading && !weight}
        onClick={weight ? () => setEditing(true) : undefined}
      />
      {weight
        ? createPortal(
            <AddWeightModal
              open={editing}
              weight={weight}
              onClose={() => {
                setEditing(false);
                qc.invalidateQueries({ queryKey: ['weights'] });
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}
