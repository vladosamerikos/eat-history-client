import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const LAST_UPDATED = '2025-02-13';

const SECTION_KEYS = ['use', 'account', 'data', 'liability', 'contact'] as const;

export function TermsPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link to="/" className="text-sm text-primary hover:underline">
        ← eat-history
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">{t('terms.title')}</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        {t('terms.lastUpdated', { date: LAST_UPDATED })}
      </p>
      <p className="mt-4 text-sm">{t('terms.intro')}</p>
      <div className="mt-6 space-y-4">
        {SECTION_KEYS.map((k) => (
          <section key={k}>
            <h2 className="text-lg font-medium">{t(`terms.sections.${k}.title`)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t(`terms.sections.${k}.body`)}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
