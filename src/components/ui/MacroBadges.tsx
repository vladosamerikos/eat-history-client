import { Flame, EggFried, Wheat, Droplet } from 'lucide-react';

interface Props {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Etiquetas localizadas opcionales (P/C/G por defecto). */
  labels?: { protein?: string; carbs?: string; fat?: string };
  /** Tamaño compacto para barras de cabecera. */
  compact?: boolean;
}

/**
 * Tira horizontal de macros tipo Stitch:
 * - Llama + kcal a la izquierda
 * - 3 píldoras coloreadas (P/C/G) a la derecha
 */
export function MacroBadges({ kcal, protein, carbs, fat, labels, compact }: Props) {
  const padX = compact ? 'px-2.5 py-1' : 'px-3 py-1.5';
  const iconSize = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <Flame className={`${iconSize} text-on-surface-variant`} />
        <div className="flex items-baseline gap-1">
          <span className={compact ? 'text-sm font-bold' : 'text-lg font-bold'}>
            {Math.round(kcal)}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            kcal
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill icon={EggFried} value={protein} suffix="g" tone="primary" label={labels?.protein ?? 'P'} compact={compact} padX={padX} />
        <Pill icon={Wheat} value={carbs} suffix="g" tone="amber" label={labels?.carbs ?? 'C'} compact={compact} padX={padX} />
        <Pill icon={Droplet} value={fat} suffix="g" tone="rose" label={labels?.fat ?? 'G'} compact={compact} padX={padX} />
      </div>
    </div>
  );
}

interface PillProps {
  icon: typeof Flame;
  value: number;
  suffix?: string;
  tone: 'primary' | 'amber' | 'rose';
  label: string;
  padX: string;
  compact?: boolean;
}

function Pill({ icon: Icon, value, suffix = '', tone, label, padX, compact }: PillProps) {
  const color =
    tone === 'primary'
      ? 'text-primary'
      : tone === 'amber'
        ? 'text-yellow-500'
        : 'text-red-500';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-surface-container border border-outline-variant/50 ${padX}`}
    >
      <Icon className={`${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} ${color}`} />
      <span className={`text-[10px] font-bold uppercase tracking-tight ${color}`}>
        {label} {Math.round(value)}
        {suffix}
      </span>
    </span>
  );
}

/**
 * Grid de 3 tarjetas (P/C/G) para el resumen diario.
 */
export function MacroTiles({
  protein,
  carbs,
  fat,
  labels,
}: {
  protein: number;
  carbs: number;
  fat: number;
  labels?: { protein?: string; carbs?: string; fat?: string };
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <MacroTile
        icon={EggFried}
        value={protein}
        label={labels?.protein ?? 'Protein'}
        color="text-primary"
        bar="bg-primary"
      />
      <MacroTile
        icon={Wheat}
        value={carbs}
        label={labels?.carbs ?? 'Carbs'}
        color="text-yellow-500"
        bar="bg-yellow-500"
      />
      <MacroTile
        icon={Droplet}
        value={fat}
        label={labels?.fat ?? 'Fat'}
        color="text-red-500"
        bar="bg-red-500"
      />
    </div>
  );
}

interface TileProps {
  icon: typeof Flame;
  value: number;
  label: string;
  color: string;
  bar: string;
}

function MacroTile({ icon: Icon, value, label, color, bar }: TileProps) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-surface-container-high p-3">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${bar}`} />
      <div className="flex flex-col items-center pl-2">
        <Icon className={`mb-1 h-5 w-5 ${color}`} />
        <span className={`text-base font-bold tabular-nums ${color}`}>
          {Math.round(value)}g
        </span>
        <span className="mt-1 text-[11px] font-semibold text-on-surface-variant">
          {label}
        </span>
      </div>
    </div>
  );
}
