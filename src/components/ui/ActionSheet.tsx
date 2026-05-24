import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';

export interface ActionSheetItem {
  key: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  items: ActionSheetItem[];
  footer?: ReactNode;
}

/**
 * Bottom action sheet (iOS-like) con opciones agrupadas.
 * Usa el design system del dark mode existente (background/border/muted).
 */
export function ActionSheet({ open, onClose, title, description, items, footer }: Props) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="action-sheet"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-t-3xl bg-background pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-2"
          >
            {(title || description) && (
              <div className="px-5 py-3 text-center">
                {title && <h3 className="text-sm font-semibold">{title}</h3>}
                {description && (
                  <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                )}
              </div>
            )}
            <ul className="divide-y divide-border border-y border-border bg-card">
              {items.map((it) => {
                const Icon = it.icon;
                const tone = it.destructive
                  ? 'text-destructive'
                  : it.disabled
                    ? 'text-muted-foreground/50'
                    : 'text-foreground';
                return (
                  <li key={it.key}>
                    <button
                      type="button"
                      disabled={it.disabled}
                      onClick={() => {
                        if (it.disabled) return;
                        it.onSelect();
                        onClose();
                      }}
                      className={`flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm transition-colors ${tone} hover:bg-muted disabled:cursor-not-allowed`}
                    >
                      {Icon && (
                        <span
                          className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-full ${
                            it.destructive
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-primary/10 text-primary'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{it.label}</p>
                        {it.description && (
                          <p className="truncate text-[11px] text-muted-foreground">
                            {it.description}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            {footer}
            <div className="px-3 pt-3 sm:hidden">
              <button
                type="button"
                onClick={onClose}
                className="h-11 w-full rounded-full bg-muted text-sm font-medium hover:bg-muted/70"
              >
                {t('common.cancel')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
