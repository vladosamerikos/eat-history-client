import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/features/auth/auth.store';
import { deleteAccount } from '@/features/auth/auth.api';
import { PageHeader, Section } from './_shared';
import { Alert } from '@/components/ui/Alert';

type Msg = { kind: 'error' | 'success'; text: string } | null;

export function PrivacySectionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  const [showDelete, setShowDelete] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<Msg>(null);

  const onDeleteAccount = async () => {
    if (!user) return;
    if (confirmEmail.trim().toLowerCase() !== (user.email ?? '').toLowerCase()) {
      setDeleteMsg({ kind: 'error', text: t('settings.danger.emailMismatch') });
      return;
    }
    setDeleting(true);
    setDeleteMsg(null);
    try {
      await deleteAccount();
      clear();
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Error' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid w-full gap-4 overflow-hidden">
      <PageHeader
        back="/app/profile"
        title={t('profile.menu.privacy')}
        subtitle={t('profile.menu.privacyDesc')}
      />

      <Section title={t('settings.privacy.documents')}>
        <ul className="grid gap-2 text-sm">
          <li>
            <Link
              to="/privacy"
              target="_blank"
              rel="noopener"
              className="block rounded-lg border border-border bg-background px-3 py-2 hover:bg-muted"
            >
              {t('settings.privacy.privacyPolicy')}
            </Link>
          </li>
          <li>
            <Link
              to="/terms"
              target="_blank"
              rel="noopener"
              className="block rounded-lg border border-border bg-background px-3 py-2 hover:bg-muted"
            >
              {t('settings.privacy.terms')}
            </Link>
          </li>
        </ul>
      </Section>

      <Section title={t('settings.danger.title')} description={t('settings.danger.description')}>
        <button
          type="button"
          onClick={() => {
            setConfirmEmail('');
            setDeleteMsg(null);
            setShowDelete(true);
          }}
          className="h-11 w-full rounded-full bg-destructive px-4 text-sm font-medium text-white"
        >
          {t('settings.privacy.deleteCta')}
        </button>
      </Section>

      {showDelete && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => !deleting && setShowDelete(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-t-3xl bg-background p-4 shadow-lg sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-destructive">{t('settings.danger.title')}</h3>
              <button
                type="button"
                onClick={() => !deleting && setShowDelete(false)}
                className="text-sm text-muted-foreground"
                aria-label={t('common.close')}
              >
                ×
              </button>
            </header>
            <p className="mb-3 break-words text-sm text-muted-foreground">
              {t('settings.danger.description')}
            </p>
            <label className="flex flex-col gap-1 text-sm">
              <span className="break-all text-xs text-muted-foreground">
                {t('settings.danger.typeEmail', { email: user?.email ?? '' })}
              </span>
              <input
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={user?.email ?? ''}
                className="h-10 w-full rounded-lg border border-border bg-background px-3"
              />
            </label>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowDelete(false)}
                disabled={deleting}
                className="h-10 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={deleting || !confirmEmail}
                onClick={onDeleteAccount}
                className="h-10 rounded-full bg-destructive px-4 text-sm font-medium text-white disabled:opacity-60"
              >
                {deleting ? '…' : t('settings.danger.cta')}
              </button>
            </div>
            {deleteMsg && (
              <Alert variant={deleteMsg.kind === 'error' ? 'error' : 'success'} className="mt-3">
                {deleteMsg.text}
              </Alert>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
