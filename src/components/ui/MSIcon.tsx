import { MaterialSymbol, type SymbolCodepoints } from 'react-material-symbols';
import { cn } from '@/lib/cn';

type MSIconProps = {
  name: SymbolCodepoints;
  size?: number;
  className?: string;
  fill?: boolean;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700;
  grade?: -25 | 0 | 200;
};

/**
 * Wrapper sobre Material Symbols Outlined.
 * Tamaño en px (default 24). Por defecto hereda color via `currentColor`.
 */
export function MSIcon({ name, size = 24, className, fill = false, weight = 400, grade = 0 }: MSIconProps) {
  return (
    <MaterialSymbol
      icon={name}
      size={size}
      fill={fill}
      weight={weight}
      grade={grade}
      className={cn('inline-block leading-none', className)}
    />
  );
}

export type { SymbolCodepoints };
