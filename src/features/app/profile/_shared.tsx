import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft, ExternalLink } from 'lucide-react';

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
    <section className="min-w-0 overflow-hidden rounded-2xl border border-surface-variant bg-surface-container-low p-4">
      {title && (
        <h3 className="break-words text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
          {title}
        </h3>
      )}
      {description && (
        <p className="mb-3 mt-1 break-words text-xs text-on-surface-variant/80">{description}</p>
      )}
      <div className={`min-w-0 ${title && !description ? 'mt-3' : ''}`}>{children}</div>
    </section>
  );
}

/**
 * Fila tipo enlace para listas dentro de `Section`. Reemplaza el patrón
 * anterior de "card dentro de card" para enlaces a documentos o páginas
 * externas.
 */
export function LinkRow({
  to,
  external,
  title,
  description,
  icon: Icon,
}: {
  to: string;
  external?: boolean;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const content = (
    <>
      {Icon && (
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-surface-container text-on-surface-variant">
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-on-background">{title}</p>
        {description && <p className="truncate text-xs text-on-surface-variant">{description}</p>}
      </div>
      {external ? (
        <ExternalLink className="h-4 w-4 flex-shrink-0 text-on-surface-variant" />
      ) : (
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-on-surface-variant" />
      )}
    </>
  );
  const className =
    'flex items-center gap-3 rounded-lg px-2 py-2 -mx-2 transition-colors hover:bg-surface-container';
  if (external) {
    return (
      <a href={to} target="_blank" rel="noopener" className={className}>
        {content}
      </a>
    );
  }
  return (
    <Link to={to} className={className}>
      {content}
    </Link>
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
      className="flex items-center gap-3 rounded-2xl border border-surface-variant bg-surface-container-low p-3 transition-colors hover:bg-surface-container"
    >
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-on-background">{title}</p>
        {description && <p className="truncate text-xs text-on-surface-variant">{description}</p>}
      </div>
      <ChevronRight className="h-5 w-5 flex-shrink-0 text-on-surface-variant" />
    </Link>
  );
}
