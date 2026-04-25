import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/features/auth/auth.store';
import { Alert } from '@/components/ui/Alert';
import { ApiError } from '@/lib/api';
import {
  fetchOnboardingProgress,
  patchOnboarding,
  type OnboardingStep,
} from './onboarding.api';

const STEP_ORDER: OnboardingStep[] = ['locale', 'name', 'goal', 'preferences', 'done'];

const GOALS = ['lose', 'maintain', 'gain', 'health'] as const;
const LOCALES = ['en', 'es', 'uk'] as const;

export function OnboardingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [step, setStep] = useState<OnboardingStep>(() => (user?.onboardingStep as OnboardingStep) ?? 'locale');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form state
  const [locale, setLocale] = useState<string>(user?.locale ?? i18n.language ?? 'en');
  const [name, setName] = useState<string>(user?.name ?? '');
  const [goal, setGoal] = useState<string>('maintain');
  const [diet, setDiet] = useState<string>('omnivore');

  useEffect(() => {
    fetchOnboardingProgress()
      .then((p) => {
        if (p.completed) navigate('/app', { replace: true });
        else setStep(p.step);
      })
      .catch(() => {/* no-op, useguard handles it */});
  }, [navigate]);

  const stepIndex = useMemo(() => STEP_ORDER.indexOf(step), [step]);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const payload = (() => {
        switch (step) {
          case 'locale':
            return { step, locale };
          case 'name':
            return { step, name };
          case 'goal':
            return { step, goal };
          case 'preferences':
            return { step, preferences: { diet } };
          case 'done':
            return { step };
        }
      })();
      const { user: updated, progress } = await patchOnboarding(payload);
      setUser(updated);
      if (progress.completed) {
        navigate('/app', { replace: true });
      } else {
        setStep(progress.step);
        if (step === 'locale') i18n.changeLanguage(locale).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-1">
          {STEP_ORDER.slice(0, -1).map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>

        <h1 className="mb-2 text-2xl font-semibold tracking-tight">{t(`onboarding.${step}.title`)}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{t(`onboarding.${step}.help`)}</p>

        <div className="mb-4 flex flex-col gap-2">
          {step === 'locale' && (
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="h-11 rounded-lg border border-border bg-background px-3"
            >
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {t(`onboarding.locales.${l}`)}
                </option>
              ))}
            </select>
          )}
          {step === 'name' && (
            <input
              type="text"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="h-11 rounded-lg border border-border bg-background px-3"
              placeholder={t('onboarding.name.placeholder') ?? ''}
            />
          )}
          {step === 'goal' && (
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGoal(g)}
                  className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                    goal === g ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                  }`}
                >
                  {t(`onboarding.goals.${g}`)}
                </button>
              ))}
            </div>
          )}
          {step === 'preferences' && (
            <select
              value={diet}
              onChange={(e) => setDiet(e.target.value)}
              className="h-11 rounded-lg border border-border bg-background px-3"
            >
              <option value="omnivore">{t('onboarding.diets.omnivore')}</option>
              <option value="vegetarian">{t('onboarding.diets.vegetarian')}</option>
              <option value="vegan">{t('onboarding.diets.vegan')}</option>
              <option value="pescatarian">{t('onboarding.diets.pescatarian')}</option>
              <option value="keto">{t('onboarding.diets.keto')}</option>
            </select>
          )}
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <button
          type="button"
          disabled={busy || (step === 'name' && !name.trim())}
          onClick={submit}
          className="mt-4 h-11 w-full rounded-full bg-primary font-medium text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? '…' : t('onboarding.continue')}
        </button>
      </div>
    </main>
  );
}
