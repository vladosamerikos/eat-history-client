import { Minus, Plus } from 'lucide-react';
import { MSIcon } from './MSIcon';

interface Props {
  /** Material Symbols icon name (preferred). */
  msIcon?: string;
  /** Fallback: lucide-style component (renderProp). */
  renderIcon?: () => React.ReactNode;
  iconClass?: string;
  labelClass?: string;
  label: string;
  unit: string;
  value: string;
  readOnly?: boolean;
  onChange: (v: string) => void;
  /** Incremento que aplican los botones +/-. Por defecto 1. */
  step?: number;
}

/**
 * Fila editable de macronutriente con icono + label + input numérico con
 * controles +/-. Reutilizado por AddMealModal y FoodsPage para mantener
 * estilo y comportamiento coherentes.
 *
 * Aplica `no-spin` para ocultar las flechitas nativas del navegador, ya
 * que los botones +/- las hacen redundantes.
 */
export function MacroInputRow({
  msIcon,
  renderIcon,
  iconClass = 'text-on-surface-variant',
  labelClass = 'text-on-surface-variant',
  label,
  unit,
  value,
  readOnly,
  onChange,
  step = 1,
}: Props) {
  const numericValue = Number(value) || 0;
  const adjust = (delta: number) => {
    if (readOnly) return;
    const next = Math.max(0, Math.round((numericValue + delta) * 10) / 10);
    onChange(String(next));
  };
  return (
    <div className="flex items-center justify-between">
      <div className="flex min-w-0 items-center gap-2">
        {msIcon ? (
          <MSIcon name={msIcon as never} size={20} className={iconClass} />
        ) : (
          renderIcon?.()
        )}
        <span className={`truncate text-[11px] font-bold uppercase tracking-wide ${labelClass}`}>
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-surface-variant/50 bg-surface-container p-1">
        <button
          type="button"
          onClick={() => adjust(-step)}
          disabled={readOnly}
          className="grid h-8 w-8 place-items-center rounded bg-surface-variant/20 text-on-surface transition-colors hover:bg-surface-variant/40 disabled:opacity-30"
          aria-label="-"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.1"
          value={value || ''}
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className={`no-spin w-16 bg-transparent text-center text-sm font-semibold text-on-background focus:outline-none ${
            readOnly ? 'opacity-70' : ''
          }`}
        />
        <span className="pr-1 text-[10px] font-semibold uppercase text-on-surface-variant">
          {unit}
        </span>
        <button
          type="button"
          onClick={() => adjust(step)}
          disabled={readOnly}
          className="grid h-8 w-8 place-items-center rounded bg-surface-variant/20 text-on-surface transition-colors hover:bg-surface-variant/40 disabled:opacity-30"
          aria-label="+"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
