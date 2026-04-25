import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  Loader2,
  Search,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  adminListAiModels,
  adminUpdateAiModel,
  listAiModels,
  updateAiPreference,
  type AiAdminModelDto,
  type AiProvider,
} from '@/features/ai/ai.api';
import { useAuthStore } from '@/features/auth/auth.store';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';
import { PageHeader, Section } from './profile/_shared';

const PROVIDERS: { id: AiProvider | 'all'; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'google', label: 'Google' },
  { id: 'openai', label: 'OpenAI' },
];

const TIER_TONE: Record<string, string> = {
  free: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  preview: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  paid: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
  limited: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
};

export function AdminAiModelsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [provider, setProvider] = useState<AiProvider | 'all'>('all');
  const [q, setQ] = useState('');

  const { data: models = [], isLoading } = useQuery<AiAdminModelDto[]>({
    queryKey: ['admin', 'ai-models', provider, q],
    queryFn: () =>
      adminListAiModels({
        provider: provider === 'all' ? undefined : provider,
        q: q || undefined,
      }),
    enabled: isAdmin,
  });

  const { data: visibleModels = [] } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () => listAiModels(),
    enabled: isAdmin,
  });

  const toggleActive = useMutation({
    mutationFn: (m: AiAdminModelDto) =>
      adminUpdateAiModel(m.id, { isActive: !m.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ai-models'] }),
  });

  const setPref = useMutation({
    mutationFn: (input: { vision?: string | null; text?: string | null }) =>
      updateAiPreference(input),
  });

  const counts = useMemo(() => {
    const byProvider: Record<string, number> = {};
    for (const m of models) byProvider[m.provider] = (byProvider[m.provider] ?? 0) + 1;
    return byProvider;
  }, [models]);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md space-y-3 px-4 py-6">
        <Link
          to="/app/profile"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('common.back') ?? 'Volver'}
        </Link>
        <Alert variant="error">{t('admin.forbidden') ?? 'Sólo para administradores'}</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-24 pt-4">
      <PageHeader
        title={t('admin.aiModels.title') ?? 'Modelos de IA'}
        back="/app/profile"
        subtitle={t('admin.aiModels.subtitle') ?? 'Gestiona qué modelos están disponibles en la app.'}
      />

      {/* Search + filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('admin.aiModels.search') ?? 'Buscar por id, nombre o descripción'}
            className="h-11 w-full rounded-full border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {PROVIDERS.map((p) => {
            const active = provider === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p.id)}
                className={`relative rounded-full px-3 py-1 text-xs font-medium transition ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.label}
                {p.id !== 'all' && counts[p.id] != null && (
                  <span className="ml-1.5 opacity-70">({counts[p.id]})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Section title={t('admin.aiModels.preferences') ?? 'Mi preferencia'}>
        <PrefRow
          taskKey="vision"
          label={t('admin.aiModels.taskVision') ?? 'Visión (foto)'}
          modelId={user?.aiModelPreferences?.vision}
          options={visibleModels.filter((m) => m.capabilities.includes('vision'))}
          onChange={(id) => setPref.mutate({ vision: id ?? null })}
        />
        <PrefRow
          taskKey="text"
          label={t('admin.aiModels.taskText') ?? 'Texto (nombre)'}
          modelId={user?.aiModelPreferences?.text}
          options={visibleModels.filter((m) => m.capabilities.includes('text'))}
          onChange={(id) => setPref.mutate({ text: id ?? null })}
        />
      </Section>

      {/* Lista */}
      <Section title={t('admin.aiModels.available') ?? 'Disponibles'}>
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('common.loading')}
          </div>
        ) : models.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('common.empty') ?? 'Sin resultados.'}</p>
        ) : (
          <ul className="-mx-2 divide-y divide-border">
            <AnimatePresence initial={false}>
              {models.map((m) => {
                return (
                  <motion.li
                    key={m.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-2 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{m.displayName}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TIER_TONE[m.tier] ?? 'bg-muted'}`}>
                            {m.tier}
                          </span>
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {m.provider}
                          </span>
                        </div>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{m.modelId}</p>
                        {m.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {m.description}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {m.capabilities.map((c) => (
                            <span
                              key={c}
                              className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary dark:bg-primary/20"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleActive.mutate(m)}
                        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${
                          m.isActive ? 'bg-primary' : 'bg-muted'
                        }`}
                        aria-label="Toggle active"
                      >
                        <motion.span
                          layout
                          transition={{ type: 'spring', stiffness: 700, damping: 30 }}
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow ${
                            m.isActive ? 'right-0.5' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </Section>
    </div>
  );
}

function PrefRow({
  taskKey: _taskKey,
  label,
  modelId,
  options,
  onChange,
}: {
  taskKey: 'vision' | 'text';
  label: string;
  modelId?: string;
  options: { id: string; displayName: string; provider: string }[];
  onChange: (id: string | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className="text-muted-foreground">{label}</span>
      <Select
        value={modelId ?? ''}
        onValueChange={(v) => onChange(v || null)}
        triggerClassName="h-9 w-full sm:max-w-[60%] text-xs"
        ariaLabel={label}
        options={[
          { value: '', label: '— auto —' },
          ...options.map((o) => ({
            value: o.id,
            label: o.displayName,
            description: o.provider,
          })),
        ]}
      />
    </label>
  );
}
