import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { verifyEmail } from './auth.api';
import { useAuthStore } from './auth.store';
import { Alert } from '@/components/ui/Alert';

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'ok' | 'fail'>('loading');
  const setUser = useAuthStore((s) => s.setUser);
  const currentUser = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!token) {
      setStatus('fail');
      return;
    }
    let cancelled = false;
    void verifyEmail(token)
      .then((res) => {
        if (cancelled) return;
        if (currentUser && currentUser.id === res.user.id) {
          setUser({ ...currentUser, emailVerified: true });
        }
        setStatus('ok');
      })
      .catch(() => {
        if (!cancelled) setStatus('fail');
      });
    return () => {
      cancelled = true;
    };
  }, [token, currentUser, setUser]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        {status === 'loading' && (
          <>
            <h1 className="text-2xl font-semibold">{t('verify.title')}</h1>
            <div className="mt-6 inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </>
        )}
        {status === 'ok' && (
          <>
            <h1 className="text-2xl font-semibold">{t('verify.success')}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t('verify.successHelp')}</p>
            <Link
              to="/app"
              className="mt-6 inline-block h-11 rounded-full bg-primary px-6 leading-[44px] text-primary-foreground"
            >
              {t('verify.open')}
            </Link>
          </>
        )}
        {status === 'fail' && (
          <>
            <h1 className="text-2xl font-semibold">{t('verify.fail')}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t('verify.failHelp')}</p>
            <Alert variant="error" className="mt-4">
              {t('reset.invalid')}
            </Alert>
            <Link to="/login" className="mt-4 inline-block text-sm text-primary hover:underline">
              {t('forgot.back')}
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
