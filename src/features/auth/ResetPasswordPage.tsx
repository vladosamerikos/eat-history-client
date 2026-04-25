import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { resetPassword } from './auth.api';
import { ApiError } from '@/lib/api';
import { Alert } from '@/components/ui/Alert';
import { PasswordInput } from '@/components/ui/PasswordInput';

const schema = z
  .object({
    password: z.string().min(8).max(128),
    confirm: z.string().min(8).max(128),
  })
  .refine((d) => d.password === d.confirm, {
    path: ['confirm'],
    message: 'mismatch',
  });

type Values = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) setError(t('reset.invalid'));
      else setError(t('errors.network'));
    }
  });

  if (!token) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <Alert variant="error">{t('reset.invalid')}</Alert>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">{t('reset.title')}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{t('reset.help')}</p>
        {done ? (
          <>
            <Alert variant="success">{t('reset.done')}</Alert>
            <p className="mt-4 text-center">
              <Link to="/login" className="text-primary hover:underline">
                {t('forgot.back')}
              </Link>
            </p>
          </>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t('reset.newPassword')}</span>
              <PasswordInput autoComplete="new-password" {...form.register('password')} />
              {form.formState.errors.password && (
                <span className="text-xs text-destructive">{form.formState.errors.password.message}</span>
              )}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t('reset.confirmPassword')}</span>
              <PasswordInput autoComplete="new-password" {...form.register('confirm')} />
              {form.formState.errors.confirm && (
                <span className="text-xs text-destructive">
                  {form.formState.errors.confirm.message === 'mismatch'
                    ? t('errors.passwordsMismatch')
                    : form.formState.errors.confirm.message}
                </span>
              )}
            </label>
            {error && <Alert variant="error">{error}</Alert>}
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="mt-2 h-11 rounded-full bg-primary text-primary-foreground font-medium disabled:opacity-60"
            >
              {form.formState.isSubmitting ? '…' : t('reset.submit')}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
