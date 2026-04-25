import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Camera,
  LogOut,
  Moon,
  Settings,
  Shield,
  ShieldCheck,
  Sun,
  SunMoon,
  Pencil,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/auth.store';
import { logoutUser } from '@/features/auth/auth.api';
import { removeAvatar, updateProfile, uploadAvatar } from './profile.api';
import { Section, MenuLink } from './profile/_shared';
import { useTheme, type ThemeMode } from '@/features/theme/theme';
import { Alert } from '@/components/ui/Alert';

export function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);
  const { mode, setMode } = useTheme();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onSaveName = async () => {
    if (!name.trim() || name === user?.name) {
      setEditingName(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await updateProfile({ name: name.trim() });
      setUser(updated);
      setEditingName(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const onPickAvatar = () => fileRef.current?.click();

  const onAvatarChange = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await uploadAvatar(file);
      setUser(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onRemoveAvatar = async () => {
    setBusy(true);
    try {
      const updated = await removeAvatar();
      setUser(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    try {
      await logoutUser();
    } finally {
      clear();
      navigate('/', { replace: true });
    }
  };

  const initials = (user?.name ?? user?.email ?? '?')
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="grid w-full gap-4 overflow-hidden">
      {/* Cabecera con avatar + nombre editable */}
      <section className="flex flex-col items-center gap-3 pt-2 text-center">
        <div className="relative">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border-2 border-border bg-muted text-2xl font-semibold text-muted-foreground">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <button
            type="button"
            onClick={onPickAvatar}
            disabled={busy}
            className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow disabled:opacity-50"
            aria-label={t('profile.changePhoto')}
          >
            <Camera className="h-4 w-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => onAvatarChange(e.target.files?.[0])}
          />
        </div>
        {user?.avatarUrl && (
          <button
            type="button"
            onClick={onRemoveAvatar}
            disabled={busy}
            className="text-xs text-muted-foreground hover:underline"
          >
            {t('profile.removePhoto')}
          </button>
        )}

        {editingName ? (
          <div className="flex w-full max-w-xs items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-center text-base"
              autoFocus
            />
            <button
              type="button"
              onClick={onSaveName}
              disabled={busy}
              className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
              aria-label={t('common.save')}
            >
              <Check className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setName(user?.name ?? '');
                setEditingName(false);
              }}
              className="grid h-10 w-10 place-items-center rounded-lg border border-border"
              aria-label={t('common.cancel')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setName(user?.name ?? '');
              setEditingName(true);
            }}
            className="inline-flex items-center gap-2 text-xl font-semibold hover:opacity-80"
          >
            <span className="break-words">{user?.name || t('profile.noName')}</span>
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        {user?.email && (
          <p className="break-all text-xs text-muted-foreground">{user.email}</p>
        )}
        {error && <Alert variant="error" className="w-full">{error}</Alert>}
      </section>

      {/* Tema */}
      <Section title={t('profile.theme.title')} description={t('profile.theme.help')}>
        <div className="grid grid-cols-3 gap-2">
          {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => {
            const Icon = m === 'light' ? Sun : m === 'dark' ? Moon : SunMoon;
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition ${
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{t(`profile.theme.${m}`)}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Menú */}
      <div className="grid min-w-0 gap-2">
        <MenuLink
          to="/app/profile/settings"
          icon={Settings}
          title={t('profile.menu.settings')}
          description={t('profile.menu.settingsDesc')}
        />
        <MenuLink
          to="/app/profile/notifications"
          icon={Bell}
          title={t('profile.menu.notifications')}
          description={t('profile.menu.notificationsDesc')}
        />
        <MenuLink
          to="/app/profile/security"
          icon={ShieldCheck}
          title={t('profile.menu.security')}
          description={t('profile.menu.securityDesc')}
        />
        <MenuLink
          to="/app/profile/privacy"
          icon={Shield}
          title={t('profile.menu.privacy')}
          description={t('profile.menu.privacyDesc')}
        />
        {user?.role === 'admin' && (
          <MenuLink
            to="/app/admin/ai-models"
            icon={Sparkles}
            title={t('profile.menu.aiModels') ?? 'Modelos de IA'}
            description={t('profile.menu.aiModelsDesc') ?? 'Configura los modelos disponibles'}
          />
        )}
      </div>

      {/* Logout */}
      <button
        type="button"
        onClick={onLogout}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-6 text-sm font-medium hover:bg-muted"
      >
        <LogOut className="h-4 w-4" />
        {t('app.logout')}
      </button>
    </div>
  );
}
