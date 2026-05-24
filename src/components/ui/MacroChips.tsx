import { MSIcon } from './MSIcon';

/**
 * Iconos canónicos de macronutrientes usados en toda la app.
 * Mantén las mismas claves en cualquier vista para coherencia visual.
 */
export const MACRO_ICON = {
  kcal: 'local_fire_department',
  protein: 'egg_alt',
  carbs: 'bakery_dining',
  fat: 'opacity',
} as const;

export const MACRO_TINT = {
  kcal: 'text-primary',
  protein: 'text-primary',
  carbs: 'text-amber-400',
  fat: 'text-rose-400',
} as const;

export const MACRO_BG = {
  kcal: 'bg-primary/10',
  protein: 'bg-primary/10',
  carbs: 'bg-amber-400/10',
  fat: 'bg-rose-400/10',
} as const;

export type MacroKey = keyof typeof MACRO_ICON;

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Chip grande con tinta de color, icono + label + valor + unidad.
 * Pensado para la cabecera del resumen diario y headers de comida.
 */
export function MacroBadge({
  macro,
  value,
  unit = 'g',
  label,
}: {
  macro: MacroKey;
  value: number;
  unit?: string;
  label?: string;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${MACRO_BG[macro]}`}>
      <MSIcon name={MACRO_ICON[macro] as never} size={20} className={MACRO_TINT[macro]} />
      <div className="flex min-w-0 flex-col leading-tight">
        {label && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
            {label}
          </span>
        )}
        <span className="text-sm font-bold tabular-nums text-on-background">
          {round1(value)}
          <span className="ml-0.5 text-[10px] font-medium uppercase text-on-surface-variant">
            {unit}
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * Stat compacto inline: icono + valor + unidad pequeña.
 * Usado en cards de lista (food cards, meal cards).
 */
export function MacroInlineStat({
  macro,
  value,
  unit = 'g',
}: {
  macro: MacroKey;
  value: number;
  unit?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums text-on-surface-variant">
      <MSIcon name={MACRO_ICON[macro] as never} size={14} className={MACRO_TINT[macro]} />
      {round1(value)}
      <span className="text-[9px] font-medium uppercase opacity-80">{unit}</span>
    </span>
  );
}
