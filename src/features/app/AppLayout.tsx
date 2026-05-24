import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ListChecks, Scale, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { VoiceDrawer } from '@/features/voice/VoiceDrawer';
import { VoiceFab } from '@/features/voice/VoiceFab';

const tabs: ReadonlyArray<{ to: string; key: string; exact?: boolean; Icon: LucideIcon }> = [
  { to: '/app', key: 'today', exact: true, Icon: CalendarDays },
  { to: '/app/foods', key: 'foods', Icon: ListChecks },
  { to: '/app/weight', key: 'weight', Icon: Scale },
  { to: '/app/profile', key: 'profile', Icon: User },
];

export function AppLayout() {
  const { t } = useTranslation();
  return (
    <div
      className="min-h-dvh w-full overflow-x-hidden bg-background text-foreground"
      style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      <main
        className="mx-auto w-full max-w-2xl overflow-x-hidden px-4 pb-4"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="mx-auto grid max-w-2xl grid-cols-4">
          {tabs.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.exact}
                className={({ isActive }) =>
                  cn(
                    'flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors',
                    isActive ? 'text-primary font-semibold' : 'text-muted-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <tab.Icon
                      aria-hidden
                      className={cn('h-5 w-5', isActive ? 'stroke-[2.4]' : 'stroke-[1.8]')}
                    />
                    <span>{t(`nav.${tab.key}`)}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <VoiceDrawer />
      <VoiceFab />
    </div>
  );
}
