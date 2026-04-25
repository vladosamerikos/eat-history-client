import * as RSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface Props {
  value: string;
  onValueChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

// Radix prohíbe value="" en SelectItem, así que mapeamos vacío a un centinela.
const EMPTY = '__empty__';
const toRadix = (v: string) => (v === '' ? EMPTY : v);
const fromRadix = (v: string) => (v === EMPTY ? '' : v);

/**
 * Wrapper sobre Radix Select con estilos Tailwind. Mobile-friendly
 * (popover nativo accesible), no muestra el `<select>` del SO.
 * Acepta `value=""` y opciones con `value=""` (se mapean a un centinela
 * internamente para cumplir la API de Radix).
 */
export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  triggerClassName,
  ariaLabel,
  disabled,
}: Props) {
  return (
    <RSelect.Root
      value={toRadix(value)}
      onValueChange={(v) => onValueChange(fromRadix(v))}
      disabled={disabled}
    >
      <RSelect.Trigger
        aria-label={ariaLabel}
        className={cn(
          'inline-flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60',
          triggerClassName,
        )}
      >
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'z-50 max-h-[60vh] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-lg',
            className,
          )}
        >
          <RSelect.Viewport className="p-1">
            {options.map((opt) => (
              <RSelect.Item
                key={opt.value || EMPTY}
                value={toRadix(opt.value)}
                className="relative flex cursor-pointer select-none items-start gap-2 rounded-md px-2 py-2 text-sm outline-none data-[highlighted]:bg-muted data-[state=checked]:font-semibold"
              >
                <RSelect.ItemIndicator className="mt-0.5">
                  <Check className="h-4 w-4 text-primary" />
                </RSelect.ItemIndicator>
                <div className="flex-1">
                  <RSelect.ItemText>{opt.label}</RSelect.ItemText>
                  {opt.description ? (
                    <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                  ) : null}
                </div>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
