import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, KeyRound, MailCheck, Smartphone, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/features/auth/auth.store';
import { resendVerifyEmail } from '@/features/auth/auth.api';
import {
  deletePasskey,
  listPasskeys,
  registerPasskey,
  type PasskeyInfo,
} from '@/features/auth/webauthn.api';
import { listSessions, revokeSession, type SessionInfo } from '../profile.api';
import { env } from '@/config/env';
import { PageHeader, Section } from './_shared';
import { Alert } from '@/components/ui/Alert';
import { useConfirm } from '@/components/ui/ConfirmDialog';

type Msg = { kind: 'success' | 'error' | 'info'; text: string } | null;

function deviceLabel(ua?: string): string {
  if (!ua) return 'Unknown device';
  if (/iPhone|iPad|iOS/i.test(ua)) return 'iOS · Safari';
  if (/Android/i.test(ua)) return /Chrome/i.test(ua) ? 'Android · Chrome' : 'Android';
  if (/Windows/i.test(ua)) return /Edg/i.test(ua) ? 'Windows · Edge' : 'Windows';
  if (/Macintosh/i.test(ua)) return /Safari/i.test(ua) && !/Chrome/i.test(ua) ? 'macOS · Safari' : 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return ua.slice(0, 40);
}

export function SecurityPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const confirm = useConfirm();

  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [pkLoading, setPkLoading] = useState(false);
  const [pkMsg, setPkMsg] = useState<Msg>(null);

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessLoading, setSessLoading] = useState(false);
  const [sessMsg, setSessMsg] = useState<Msg>(null);

  const [verifyMsg, setVerifyMsg] = useState<Msg>(null);

  const loadPasskeys = async () => {
    setPkLoading(true);
    try {
      setPasskeys(await listPasskeys());
    } catch (err) {
      setPkMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Error' });
    } finally {
      setPkLoading(false);
    }
  };
  const loadSessions = async () => {
    setSessLoading(true);
    try {
      setSessions(await listSessions());
    } catch (err) {
      setSessMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Error' });
    } finally {
      setSessLoading(false);
    }
  };

  useEffect(() => {
    void loadPasskeys();
    void loadSessions();
  }, []);

  const onAddPasskey = async () => {
    setPkMsg(null);
    try {
      await registerPasskey(navigator.userAgent.slice(0, 60));
      setPkMsg({ kind: 'success', text: t('settings.passkeys.added') });
      await loadPasskeys();
    } catch (err) {
      setPkMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Error' });
    }
  };

  const onDeletePasskey = async (id: string) => {
    const ok = await confirm({
      title: t('common.deleteConfirmTitle'),
      description: t('settings.passkeys.confirmDelete'),
      destructive: true,
      confirmText: t('common.delete'),
    });
    if (!ok) return;
    setPkMsg(null);
    try {
      await deletePasskey(id);
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setPkMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Error' });
    }
  };

  const onRevoke = async (id: string) => {
    const ok = await confirm({
      title: t('common.deleteConfirmTitle'),
      description: t('settings.sessions.confirmRevoke'),
      destructive: true,
      confirmText: t('common.delete'),
    });
    if (!ok) return;
    setSessMsg(null);
    try {
      await revokeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setSessMsg({ kind: 'success', text: t('settings.sessions.revoked') });
    } catch (err) {
      setSessMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Error' });
    }
  };

  const onResendVerify = async () => {
    if (!user?.email) return;
    setVerifyMsg(null);
    try {
      await resendVerifyEmail(user.email);
      setVerifyMsg({ kind: 'success', text: t('verify.resent') });
    } catch {
      setVerifyMsg({ kind: 'error', text: t('errors.generic') });
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="grid w-full min-w-0 gap-4 overflow-hidden">
      <PageHeader
        back="/app/profile"
        title={t('profile.menu.security')}
        subtitle={t('profile.menu.securityDesc')}
      />

      {/* Email + verificación */}
      <Section title={t('settings.security.email')}>
        <p className="mb-2 break-all text-sm">
          <span className="font-medium">{user?.email ?? '—'}</span>
        </p>
        {user && !user.emailVerified ? (
          <Alert variant="info">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0 break-words">{t('verify.banner')}</span>
              <button
                type="button"
                onClick={onResendVerify}
                className="flex-shrink-0 rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
              >
                {t('verify.bannerCta')}
              </button>
            </div>
          </Alert>
        ) : (
          <p className="inline-flex items-center gap-1 text-xs text-success">
            <MailCheck className="h-4 w-4 flex-shrink-0" />
            {t('settings.security.emailVerified')}
          </p>
        )}
        <p className="mt-3 break-words text-xs text-muted-foreground">
          {t('settings.security.changeEmailSoon')}
        </p>
        {verifyMsg && (
          <Alert variant={verifyMsg.kind === 'error' ? 'error' : 'success'} className="mt-3">
            {verifyMsg.text}
          </Alert>
        )}
      </Section>

      {/* Google */}
      <Section title={t('settings.security.googleTitle')} description={t('settings.security.googleHelp')}>
        {user?.email ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="inline-flex min-w-0 items-center gap-2 text-sm">
              {user.googleConnected ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-success" />
              ) : (
                <Globe className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 break-words">
                {user.googleConnected
                  ? t('settings.security.googleConnected')
                  : t('settings.security.googleStatus')}
              </span>
            </p>
            <a
              href={`${env.apiBaseUrl}/auth/google`}
              className="inline-flex h-10 flex-shrink-0 items-center justify-center rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              {user.googleConnected
                ? t('settings.security.googleReconnect')
                : t('settings.security.googleLink')}
            </a>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('settings.security.noEmail')}</p>
        )}
      </Section>

      {/* Passkeys */}
      <Section title={t('settings.passkeys.title')} description={t('settings.passkeys.help')}>
        {pkLoading ? (
          <p className="text-sm text-muted-foreground">…</p>
        ) : passkeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('settings.passkeys.empty')}</p>
        ) : (
          <ul className="grid gap-2">
            {passkeys.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm"
              >
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-background">
                  <KeyRound className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate break-all font-medium">{p.deviceName || t('settings.passkeys.unnamed')}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDeletePasskey(p.id)}
                  className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10"
                  aria-label={t('settings.passkeys.delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onAddPasskey}
          className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"
        >
          {t('settings.passkeys.add')}
        </button>
        {pkMsg && (
          <Alert variant={pkMsg.kind === 'error' ? 'error' : 'success'} className="mt-3">
            {pkMsg.text}
          </Alert>
        )}
      </Section>

      {/* Sesiones activas */}
      <Section title={t('settings.sessions.title')} description={t('settings.sessions.help')}>
        {sessLoading ? (
          <p className="text-sm text-muted-foreground">…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('settings.sessions.empty')}</p>
        ) : (
          <ul className="grid gap-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm"
              >
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-background">
                  <Smartphone className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{deviceLabel(s.userAgent)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {fmtDate(s.createdAt)} · {s.ip ?? '—'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRevoke(s.id)}
                  className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10"
                  aria-label={t('settings.sessions.revoke')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {sessMsg && (
          <Alert variant={sessMsg.kind === 'error' ? 'error' : 'success'} className="mt-3">
            {sessMsg.text}
          </Alert>
        )}
      </Section>

      <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
        <AlertTriangle className="mt-[2px] h-4 w-4 flex-shrink-0" />
        <span className="min-w-0 break-words">{t('settings.security.tip')}</span>
      </p>
    </div>
  );
}
