import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { forgotPassword } from './auth.api';
import { Alert } from '@/components/ui/Alert';

const schema = z.object({ email: z.string().email() });
type Values = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const onSubmit = form.handleSubmit(async ({ email }) => {
    await forgotPassword(email).catch(() => undefined);
    setDone(true);
  });

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">{t('forgot.title')}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{t('forgot.help')}</p>
        {done ? (
          <Alert variant="success">{t('forgot.sent')}</Alert>
        ) : (
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
                <span className="text-xs text-destructive">{form.formState.errors.email.message}</span>
              )}
            </label>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="mt-2 h-11 rounded-full bg-primary text-primary-foreground font-medium disabled:opacity-60"
            >
              {form.formState.isSubmitting ? '…' : t('forgot.submit')}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            {t('forgot.back')}
          </Link>
        </p>
      </div>
    </main>
  );
}
