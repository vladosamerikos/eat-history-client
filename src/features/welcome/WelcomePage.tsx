import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { env } from '@/config/env';
import { startGuest } from '@/features/auth/auth.api';
import { cn } from '@/lib/cn';

const ROTATE_MS = 2500;

export function WelcomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locales = env.supportedLocales;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % locales.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [locales.length]);

  useEffect(() => {
    void i18n.changeLanguage(locales[index]);
  }, [index, i18n, locales]);

  const onContinue = async () => {
    try {
      await startGuest();
    } catch {
      // tolerable: el servidor puede estar caído; igualmente vamos a registro
    }
    navigate('/register');
  };

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-between p-6">
      <div className="flex w-full justify-end">
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
          {t('welcome.login')}
        </Link>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <AnimatePresence mode="wait">
          <motion.h1
            key={locales[index]}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl font-semibold tracking-tight sm:text-6xl"
          >
            {t('welcome.greeting')}
          </motion.h1>
        </AnimatePresence>
        <p className="mt-4 max-w-md text-base text-muted-foreground">{t('welcome.tagline')}</p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <button
          type="button"
          onClick={onContinue}
          className={cn(
            'h-12 w-full rounded-full bg-primary text-primary-foreground',
            'font-medium shadow-sm transition active:scale-[0.98]',
          )}
        >
          {t('welcome.continue')}
        </button>
        <Link
          to="/register"
          className="flex h-11 w-full items-center justify-center rounded-full border border-border bg-transparent text-sm font-medium hover:bg-muted"
        >
          {t('welcome.register')}
        </Link>
      </div>
    </main>
  );
}
