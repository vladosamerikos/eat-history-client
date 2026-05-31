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

export const MACRO_BORDER = {
  kcal: 'border-primary',
  protein: 'border-primary',
  carbs: 'border-amber-400',
  fat: 'border-rose-400',
} as const;

export type MacroKey = keyof typeof MACRO_ICON;

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Chip vertical con borde de color a la izquierda. Icono arriba, valor grande,
 * label abajo (ocupa el alto entero, evita desbordes en idiomas largos).
 * Pensado para la cabecera del resumen diario.
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
    <div
      className={`flex min-w-0 flex-col items-center justify-between gap-1 rounded-xl border-l-4 px-2 py-3 text-center ${MACRO_BORDER[macro]} ${MACRO_BG[macro]}`}
    >
      <MSIcon name={MACRO_ICON[macro] as never} size={20} className={MACRO_TINT[macro]} />
      <span className={`text-base font-bold tabular-nums leading-none ${MACRO_TINT[macro]}`}>
        {round1(value)}
        <span className="ml-0.5 text-[10px] font-medium uppercase opacity-80">{unit}</span>
      </span>
      {label && (
        <span className="block w-full break-words text-[10px] font-semibold uppercase leading-tight tracking-wider text-on-surface-variant">
          {label}
        </span>
      )}
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
