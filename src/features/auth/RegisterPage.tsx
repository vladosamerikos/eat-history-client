import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useAuthStore } from '@/features/auth/auth.store';
import { registerUser } from '@/features/auth/auth.api';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Alert } from '@/components/ui/Alert';
import { PasswordInput } from '@/components/ui/PasswordInput';

const schema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'termsRequired' }),
  }),
});

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', acceptedTerms: false as unknown as true },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const { user } = await registerUser({
        name: values.name,
        email: values.email,
        password: values.password,
        acceptedTerms: values.acceptedTerms,
        locale: i18n.language,
      });
      setUser(user);
      navigate('/app', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.status === 409 ? t('errors.emailTaken') : err.message);
      } else setServerError(t('errors.network'));
    }
  });

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-3xl font-semibold tracking-tight">{t('auth.register.title')}</h1>

        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t('auth.name')}</span>
            <input
              type="text"
              autoComplete="name"
              className="h-11 rounded-lg border border-border bg-background px-3"
              {...form.register('name')}
            />
          </label>

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
            <PasswordInput autoComplete="new-password" {...form.register('password')} />
            {form.formState.errors.password && (
              <span className="text-xs text-destructive">
                {form.formState.errors.password.message}
              </span>
            )}
          </label>

          <label className="mt-2 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              {...form.register('acceptedTerms')}
              className="mt-1 h-4 w-4 rounded border-border accent-primary"
            />
            <span>
              {t('auth.register.termsPrefix')}{' '}
              <Link
                to="/terms"
                target="_blank"
                className="font-medium text-primary hover:underline"
              >
                {t('terms.linkShort')}
              </Link>{' '}
              {t('auth.register.termsAnd')}{' '}
              <Link
                to="/privacy"
                target="_blank"
                className="font-medium text-primary hover:underline"
              >
                {t('privacy.linkShort')}
              </Link>
              .
            </span>
          </label>
          {form.formState.errors.acceptedTerms && (
            <span className="text-xs text-destructive">{t('errors.termsRequired')}</span>
          )}

          <p className="text-xs text-muted-foreground">{t('auth.register.verifyHint')}</p>

          {serverError && <Alert variant="error">{serverError}</Alert>}

          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className={cn(
              'mt-2 h-11 rounded-full bg-primary text-primary-foreground font-medium',
              'transition active:scale-[0.98] disabled:opacity-60',
            )}
          >
            {form.formState.isSubmitting ? '…' : t('auth.register.submit')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t('auth.register.haveAccount')}{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t('auth.login.linkShort')}
          </Link>
        </p>
      </div>
    </main>
  );
}
