import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft } from 'lucide-react';

export function Section({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-background p-4 shadow-sm">
      {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
      {description && <p className="mb-3 mt-0.5 text-xs text-muted-foreground">{description}</p>}
      <div className={description || title ? '' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({
  back,
  title,
  subtitle,
  right,
}: {
  back?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-center gap-2 pt-2">
      {back && (
        <Link
          to={back}
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function MenuLink({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3 shadow-sm transition hover:bg-muted"
    >
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-muted text-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
      </div>
      <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
    </Link>
  );
}
