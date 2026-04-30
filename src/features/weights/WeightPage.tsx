import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Scale, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import { deleteWeight, listWeights, type Weight } from './weights.api';
import { AddWeightModal } from './AddWeightModal';

type Range = 30 | 90 | 365;

function isoNDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function WeightPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Weight | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [range, setRange] = useState<Range>(30);

  const list = useQuery<Weight[]>({
    queryKey: ['weights', { from: isoNDaysAgo(range) }],
    queryFn: () => listWeights({ from: isoNDaysAgo(range), limit: 1000 }),
  });

  const items = list.data ?? [];

  // Para gráfico: orden ascendente por fecha+hora.
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) =>
        (a.date + (a.time ?? '00:00')).localeCompare(b.date + (b.time ?? '00:00')),
      ),
    [items],
  );

  const latest = sorted[sorted.length - 1];
  const first = sorted[0];
  const delta = latest && first && latest._id !== first._id ? latest.kg - first.kg : null;

  const del = useMutation({
    mutationFn: (id: string) => deleteWeight(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['weights'] });
      qc.invalidateQueries({ queryKey: ['weight-latest'] });
      toast.success(t('common.saved'));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t('common.errorGeneric')),
  });

  const fmtDate = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: 'short', year: 'numeric' }),
    [i18n.language],
  );

  return (
    <section className="grid gap-3">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('weight.title')}</h2>
          <p className="text-xs text-muted-foreground">{t('weight.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm"
        >
          <Plus className="h-4 w-4" /> {t('weight.add')}
        </button>
      </header>

      {/* Hero card: latest + delta */}
      <div className="rounded-2xl border border-border bg-muted/30 p-4">
        {latest ? (
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('weight.latest')}
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums">
                {latest.kg.toFixed(1)}
                <span className="ml-1 text-base font-normal text-muted-foreground">kg</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {fmtDate.format(new Date(`${latest.date}T00:00:00`))}
                {latest.time ? ` · ${latest.time}` : ''}
              </p>
            </div>
            {delta !== null && (
              <div
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold tabular-nums ${
                  delta < 0
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : delta > 0
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      : 'bg-muted text-muted-foreground'
                }`}
                title={t('weight.deltaInRange', { days: range }) ?? ''}
              >
                {delta < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5" />
                ) : delta > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : null}
                {delta > 0 ? '+' : ''}
                {delta.toFixed(1)} kg
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
            <Scale className="h-8 w-8" />
            <p className="text-sm">{t('weight.empty')}</p>
          </div>
        )}

        {/* Chart */}
        {sorted.length > 1 && <WeightChart data={sorted} />}

        {/* Range selector */}
        <div className="mt-3 flex items-center justify-end gap-1">
          {([30, 90, 365] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                range === r
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {r === 365 ? '1Y' : `${r}d`}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="grid gap-1.5">
        {items.length === 0 && !list.isLoading && (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            {t('weight.empty')}
          </p>
        )}
        {items.map((w) => (
          <div
            key={w._id}
            className="flex items-center gap-2 rounded-xl border border-border bg-background p-2"
          >
            {w.photoUrl ? (
              <img
                src={w.photoUrl}
                alt=""
                loading="lazy"
                onClick={() => setViewingPhoto(w.photoUrl ?? null)}
                className="h-12 w-12 flex-shrink-0 cursor-zoom-in rounded-lg object-cover transition-transform active:scale-95"
              />
            ) : (
              <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <Scale className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold tabular-nums">
                {w.kg.toFixed(1)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">kg</span>
                {w.bodyFat != null && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    · {w.bodyFat}% {t('weight.fat')}
                  </span>
                )}
              </p>
              <p className="text-[11px] leading-tight text-muted-foreground">
                {fmtDate.format(new Date(`${w.date}T00:00:00`))}
                {w.time ? ` · ${w.time}` : ''}
                {w.notes ? ` · ${w.notes}` : ''}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setEditing(w)}
                className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t('common.edit') ?? 'Edit'}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirm({
                    title: t('common.deleteConfirmTitle'),
                    description: t('weight.deleteConfirm'),
                    destructive: true,
                    confirmText: t('common.delete'),
                  });
                  if (ok) del.mutate(w._id);
                }}
                className="grid h-8 w-8 place-items-center rounded-full text-destructive hover:bg-destructive/10"
                aria-label={t('common.delete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <AddWeightModal open={adding} onClose={() => setAdding(false)} />
      <AddWeightModal open={!!editing} onClose={() => setEditing(null)} weight={editing} />
      <PhotoViewer src={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </section>
  );
}

interface WeightChartProps {
  data: Weight[];
}

function WeightChart({ data }: WeightChartProps) {
  // SVG sparkline simple. Eje X = índice, Eje Y = kg.
  const W = 320;
  const H = 100;
  const PAD_X = 8;
  const PAD_Y = 8;

  const xs = data.map((_, i) => i);
  const ys = data.map((d) => d.kg);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeY = Math.max(0.5, maxY - minY);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const rangeX = Math.max(1, maxX - minX);

  const px = (i: number) => PAD_X + ((i - minX) / rangeX) * (W - PAD_X * 2);
  const py = (v: number) => H - PAD_Y - ((v - minY) / rangeY) * (H - PAD_Y * 2);

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(2)} ${py(d.kg).toFixed(2)}`)
    .join(' ');
  const areaPath = `${linePath} L ${px(maxX).toFixed(2)} ${H - PAD_Y} L ${px(minX).toFixed(2)} ${H - PAD_Y} Z`;

  return (
    <div className="mt-3 -mx-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="weightFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="text-primary">
          <path d={areaPath} fill="url(#weightFill)" />
          <path d={linePath} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) => (
            <circle key={d._id} cx={px(i)} cy={py(d.kg)} r={i === data.length - 1 ? 2.4 : 1.4} fill="currentColor" />
          ))}
        </g>
      </svg>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{minY.toFixed(1)} kg</span>
        <span>{maxY.toFixed(1)} kg</span>
      </div>
    </div>
  );
}
