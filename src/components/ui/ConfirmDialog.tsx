import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useTranslation } from 'react-i18next';

export interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<PendingState | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const close = (value: boolean) => {
    if (pending) pending.resolve(value);
    setPending(null);
  };

  const ctx = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={ctx}>
      {children}
      <AlertDialog.Root open={Boolean(pending)} onOpenChange={(open) => !open && close(false)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/50" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[61] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-5 shadow-2xl focus:outline-none">
            {pending?.title && (
              <AlertDialog.Title className="text-base font-semibold">
                {pending.title}
              </AlertDialog.Title>
            )}
            {pending?.description && (
              <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
                {pending.description}
              </AlertDialog.Description>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button
                  type="button"
                  className="h-9 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"
                  onClick={() => close(false)}
                >
                  {pending?.cancelText ?? t('common.cancel')}
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  type="button"
                  className={
                    'h-9 rounded-full px-4 text-sm font-medium ' +
                    (pending?.destructive
                      ? 'bg-destructive text-destructive-foreground hover:opacity-90'
                      : 'bg-primary text-primary-foreground hover:opacity-90')
                  }
                  onClick={() => close(true)}
                >
                  {pending?.confirmText ?? t('common.confirm')}
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return ctx;
}
