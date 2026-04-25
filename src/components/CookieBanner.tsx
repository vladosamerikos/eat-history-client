import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const KEY = 'cookies-acknowledged-v1';

export function CookieBanner() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== '1') setShow(true);
    } catch {
      // ignore
    }
  }, []);

  if (!show) return null;
  return (
    <div
      className="fixed inset-x-2 z-50 mx-auto max-w-md rounded-2xl border border-border bg-background p-4 text-foreground shadow-2xl backdrop-blur"
      style={{ bottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <p className="text-sm font-medium">{t('cookies.title')}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t('cookies.body')}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Link to="/privacy" className="text-xs text-primary hover:underline">
          {t('cookies.more')}
        </Link>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(KEY, '1');
            } catch {
              // ignore
            }
            setShow(false);
          }}
          className="h-9 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {t('cookies.accept')}
        </button>
      </div>
    </div>
  );
}
