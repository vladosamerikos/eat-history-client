import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'error' | 'success' | 'info';

const styles: Record<Variant, string> = {
  error:
    'border-destructive/40 bg-destructive/10 text-destructive dark:bg-destructive/15',
  success:
    'border-success/40 bg-success/10 text-success dark:bg-success/15',
  info: 'border-border bg-muted text-foreground',
};

const icons: Record<Variant, string> = {
  error: '⚠',
  success: '✓',
  info: 'ℹ',
};

export interface AlertProps {
  variant?: Variant;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Alert({ variant = 'info', title, children, className }: AlertProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-2 rounded-xl border px-3 py-2 text-sm', styles[variant], className)}
    >
      <span aria-hidden className="select-none font-semibold">
        {icons[variant]}
      </span>
      <div className="flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
      </div>
    </div>
  );
}
