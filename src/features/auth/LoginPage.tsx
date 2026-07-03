import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { env } from '@/config/env';
import { useCapabilities } from '@/features/capabilities/useCapabilities';
import { useAuthStore } from '@/features/auth/auth.store';
import { loginUser } from '@/features/auth/auth.api';
import { loginWithPasskey, startGoogleLogin } from '@/features/auth/webauthn.api';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Alert } from '@/components/ui/Alert';
import { PasswordInput } from '@/components/ui/PasswordInput';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const { capabilities } = useCapabilities();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const { user } = await loginUser(values);
      setUser(user);
      navigate('/app', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.status === 401 ? t('errors.invalidCredentials') : err.message);
      } else setServerError(t('errors.network'));
    }
  });

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-3xl font-semibold tracking-tight">{t('auth.login.title')}</h1>

        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t('auth.email')}</span>
            <input
              type="email"
              autoComplete="email"
              className="h-11 rounded-lg border border-border bg-background px-3"
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <span className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t('auth.password')}</span>
            <PasswordInput autoComplete="current-password" {...form.register('password')} />
            {form.formState.errors.password && (
              <span className="text-xs text-destructive">
                {form.formState.errors.password.message}
              </span>
            )}
          </label>

          <div className="text-right">
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              {t('auth.forgotPassword')}
            </Link>
          </div>

          {serverError && <Alert variant="error">{serverError}</Alert>}

          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className={cn(
              'mt-2 h-11 rounded-full bg-primary text-primary-foreground font-medium',
              'transition active:scale-[0.98] disabled:opacity-60',
            )}
          >
            {form.formState.isSubmitting ? '…' : t('auth.login.submit')}
          </button>
        </form>

        <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>{t('auth.or')}</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={!capabilities.googleAuth}
            onClick={() => startGoogleLogin(env.apiBaseUrl)}
            title={!capabilities.googleAuth ? (t('auth.disabled.google') ?? '') : undefined}
            className="h-11 rounded-full border border-border text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('auth.continueWithGoogle')}
          </button>
          <button
            type="button"
            onClick={async () => {
              setServerError(null);
              try {
                const email = form.getValues('email') || undefined;
                const { user } = await loginWithPasskey(email);
                setUser(user);
                navigate('/app', { replace: true });
              } catch (err) {
                setServerError(err instanceof Error ? err.message : 'Passkey error');
              }
            }}
            className="h-11 rounded-full border border-border text-sm font-medium hover:bg-muted"
          >
            {t('auth.continueWithPasskey')}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            {t('auth.register.linkShort')}
          </Link>
        </p>
      </div>
    </main>
  );
}
