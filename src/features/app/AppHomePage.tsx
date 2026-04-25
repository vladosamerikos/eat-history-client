import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth.store';
import { logoutUser } from '@/features/auth/auth.api';
import { registerPasskey } from '@/features/auth/webauthn.api';
import { useCapabilities } from '@/features/capabilities/useCapabilities';
import { Alert } from '@/components/ui/Alert';

export function AppHomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const { capabilities } = useCapabilities();
  const [passkeyMsg, setPasskeyMsg] = useState<string | null>(null);

  const onLogout = async () => {
    try {
      await logoutUser();
    } finally {
      clear();
      navigate('/', { replace: true });
    }
  };

  const onAddPasskey = async () => {
    setPasskeyMsg(null);
    try {
      await registerPasskey(navigator.userAgent.slice(0, 60));
      setPasskeyMsg(t('app.passkey.added') ?? 'Passkey added');
    } catch (err) {
      setPasskeyMsg(err instanceof Error ? err.message : 'Error');
    }
  };

  return (
    <main className="min-h-dvh p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {t('app.hello', { name: user?.name ?? '' })}
        </h1>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-full border border-border px-4 py-1.5 text-sm hover:bg-muted"
        >
          {t('app.logout')}
        </button>
      </header>

      <section className="mt-8 rounded-2xl border border-border p-4">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">{t('app.capabilities')}</h2>
        <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          {Object.entries(capabilities).map(([k, v]) => (
            <li key={k} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
              <span className="capitalize">{k}</span>
              <span className={v ? 'text-green-600' : 'text-muted-foreground'}>
                {v ? '✓' : '·'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-border p-4">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">{t('app.passkey.title')}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t('app.passkey.help')}</p>
        <button
          type="button"
          onClick={onAddPasskey}
          className="h-10 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"
        >
          {t('app.passkey.add')}
        </button>
        {passkeyMsg && (
          <Alert
            className="mt-2"
            variant={passkeyMsg.toLowerCase().includes('error') || passkeyMsg.toLowerCase().includes('fail') ? 'error' : 'success'}
          >
            {passkeyMsg}
          </Alert>
        )}
      </section>
    </main>
  );
}
