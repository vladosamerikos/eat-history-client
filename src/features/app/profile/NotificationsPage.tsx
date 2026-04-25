import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  disablePushSubscription,
  ensurePushSubscription,
  getPushPublicKey,
  sendTestPush,
  subscribePush,
  unsubscribePush,
} from '@/features/push/push.api';
import { PageHeader, Section } from './_shared';
import { Alert } from '@/components/ui/Alert';

type Msg = { kind: 'success' | 'error' | 'info'; text: string } | null;

export function NotificationsPage() {
  const { t } = useTranslation();
  const supported =
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushPublicKey, setPushPublicKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    if (!supported) {
      setPushEnabled(false);
      return;
    }
    void getPushPublicKey().then((r) => setPushPublicKey(r.publicKey));
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((s) => setPushEnabled(Boolean(s)));
  }, [supported]);

  const onEnable = async () => {
    setMsg(null);
    if (!supported || !pushPublicKey) {
      setMsg({ kind: 'info', text: t('push.unsupported') });
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setMsg({ kind: 'error', text: t('push.denied') });
        return;
      }
      const sub = await ensurePushSubscription(pushPublicKey);
      await subscribePush(sub);
      setPushEnabled(true);
      setMsg({ kind: 'success', text: t('push.enabled') });
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Error' });
    }
  };

  const onDisable = async () => {
    setMsg(null);
    try {
      const endpoint = await disablePushSubscription();
      if (endpoint) await unsubscribePush(endpoint);
      setPushEnabled(false);
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Error' });
    }
  };

  const onTest = async () => {
    setMsg(null);
    try {
      await sendTestPush();
      setMsg({ kind: 'success', text: t('push.testSent') });
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Error' });
    }
  };

  return (
    <div className="grid w-full gap-4 overflow-hidden">
      <PageHeader
        back="/app/profile"
        title={t('profile.menu.notifications')}
        subtitle={t('profile.menu.notificationsDesc')}
      />

      <Section title={t('push.title')} description={t('push.help')}>
        {!supported ? (
          <Alert variant="info">{t('push.unsupported')}</Alert>
        ) : (
          <div className="flex flex-wrap gap-2">
            {pushEnabled ? (
              <>
                <button
                  type="button"
                  onClick={onDisable}
                  className="h-11 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"
                >
                  {t('push.disable')}
                </button>
                <button
                  type="button"
                  onClick={onTest}
                  className="h-11 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"
                >
                  {t('push.test')}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onEnable}
                className="h-11 w-full rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground sm:w-auto"
              >
                {t('push.enable')}
              </button>
            )}
          </div>
        )}
        {msg && (
          <Alert
            variant={msg.kind === 'error' ? 'error' : msg.kind === 'success' ? 'success' : 'info'}
            className="mt-3"
          >
            {msg.text}
          </Alert>
        )}
      </Section>
    </div>
  );
}
