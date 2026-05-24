import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { env } from '@/config/env';
import { DEFAULT_UNITS, useAuthStore, type UnitPreferences } from '@/features/auth/auth.store';
import { updateSettings } from '../settings.api';
import { updateUnits } from '../profile.api';
import { PageHeader, Section } from './_shared';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';

const DEFAULT_TIMES = { breakfast: '09:00', lunch: '14:00', snack: '17:30', dinner: '21:00' };
type MealKey = keyof typeof DEFAULT_TIMES;
const MEAL_KEYS: MealKey[] = ['breakfast', 'lunch', 'snack', 'dinner'];

type Msg = { kind: 'success' | 'error'; text: string } | null;

export function GeneralSettingsPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const tz = useMemo(
    () =>
      user?.reminderTimezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      'Europe/Madrid',
    [user?.reminderTimezone],
  );
  const [remindersEnabled, setRemindersEnabled] = useState(user?.remindersEnabled ?? true);
  const [times, setTimes] = useState<typeof DEFAULT_TIMES>({
    ...DEFAULT_TIMES,
    ...(user?.reminderTimes ?? {}),
  });
  const [remindersTz, setRemindersTz] = useState(tz);
  const [msg, setMsg] = useState<Msg>(null);
  const [langMsg, setLangMsg] = useState<Msg>(null);
  const [units, setUnits] = useState<UnitPreferences>({
    ...DEFAULT_UNITS,
    ...(user?.units ?? {}),
  });
  const [unitsMsg, setUnitsMsg] = useState<Msg>(null);

  const onChangeUnit = async <K extends keyof UnitPreferences>(
    key: K,
    value: UnitPreferences[K],
  ) => {
    setUnitsMsg(null);
    const next = { ...units, [key]: value };
    setUnits(next);
    try {
      const updated = await updateUnits({ [key]: value } as Partial<UnitPreferences>);
      setUser(updated);
      setUnitsMsg({ kind: 'success', text: t('settings.units.saved') });
    } catch (err) {
      setUnitsMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Error' });
    }
  };

  const supportedLocales: string[] = (env.supportedLocales ?? ['es', 'en', 'uk']).filter(Boolean);
  const currentLocale = i18n.resolvedLanguage || i18n.language || env.defaultLocale || 'es';

  const onChangeLang = async (locale: string) => {
    setLangMsg(null);
    try {
      await i18n.changeLanguage(locale);
      const updated = await updateSettings({ locale });
      setUser(updated);
      setLangMsg({ kind: 'success', text: t('settings.language.saved') });
    } catch (err) {
      setLangMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Error' });
    }
  };

  const onSaveReminders = async () => {
    setMsg(null);
    try {
      const updated = await updateSettings({
        remindersEnabled,
        reminderTimes: times,
        reminderTimezone: remindersTz,
      });
      setUser(updated);
      setMsg({ kind: 'success', text: t('reminders.saved') });
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Error' });
    }
  };

  return (
    <div className="grid w-full gap-4 overflow-hidden">
      <PageHeader
        back="/app/profile"
        title={t('profile.menu.settings')}
        subtitle={t('profile.menu.settingsDesc')}
      />

      <Section title={t('settings.language.title')} description={t('settings.language.help')}>
        <Select
          value={currentLocale}
          onValueChange={(v) => onChangeLang(v)}
          triggerClassName="h-11 w-full rounded-lg"
          options={supportedLocales.map((loc) => ({
            value: loc,
            label: t(`settings.locales.${loc}`, { defaultValue: loc }),
          }))}
        />
        {langMsg && (
          <Alert variant={langMsg.kind === 'error' ? 'error' : 'success'} className="mt-3">
            {langMsg.text}
          </Alert>
        )}
      </Section>

      <Section title={t('settings.units.title')} description={t('settings.units.help')}>
        <div className="grid gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted-foreground">{t('settings.units.weight')}</span>
            <Select
              value={units.weight}
              onValueChange={(v) => onChangeUnit('weight', v as 'kg' | 'lb')}
              triggerClassName="h-11 w-full rounded-lg"
              options={[
                { value: 'kg', label: t('settings.units.weightKg') },
                { value: 'lb', label: t('settings.units.weightLb') },
              ]}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted-foreground">{t('settings.units.volume')}</span>
            <Select
              value={units.volume}
              onValueChange={(v) => onChangeUnit('volume', v as 'ml' | 'floz')}
              triggerClassName="h-11 w-full rounded-lg"
              options={[
                { value: 'ml', label: t('settings.units.volumeMl') },
                { value: 'floz', label: t('settings.units.volumeFloz') },
              ]}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted-foreground">{t('settings.units.height')}</span>
            <Select
              value={units.height}
              onValueChange={(v) => onChangeUnit('height', v as 'cm' | 'ft_in')}
              triggerClassName="h-11 w-full rounded-lg"
              options={[
                { value: 'cm', label: t('settings.units.heightCm') },
                { value: 'ft_in', label: t('settings.units.heightFtIn') },
              ]}
            />
          </label>
        </div>
        {unitsMsg && (
          <Alert variant={unitsMsg.kind === 'error' ? 'error' : 'success'} className="mt-3">
            {unitsMsg.text}
          </Alert>
        )}
      </Section>

      <Section title={t('reminders.title')} description={t('reminders.help')}>
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={remindersEnabled}
            onChange={(e) => setRemindersEnabled(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          {t('reminders.enabled')}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {MEAL_KEYS.map((meal) => (
            <label key={meal} className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-muted-foreground">{t(`reminders.times.${meal}`)}</span>
              <input
                type="time"
                value={times[meal]}
                onChange={(e) => setTimes((prev) => ({ ...prev, [meal]: e.target.value }))}
                className="h-10 rounded-lg border border-border bg-background px-2"
              />
            </label>
          ))}
        </div>
        <label className="mt-3 flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted-foreground">{t('reminders.timezone')}</span>
          <input
            type="text"
            value={remindersTz}
            onChange={(e) => setRemindersTz(e.target.value)}
            className="h-10 rounded-lg border border-border bg-background px-3"
          />
        </label>
        <button
          type="button"
          onClick={onSaveReminders}
          className="mt-4 h-11 w-full rounded-full bg-primary text-sm font-medium text-primary-foreground"
        >
          {t('reminders.save')}
        </button>
        {msg && (
          <Alert variant={msg.kind === 'error' ? 'error' : 'success'} className="mt-3">
            {msg.text}
          </Alert>
        )}
      </Section>
    </div>
  );
}
