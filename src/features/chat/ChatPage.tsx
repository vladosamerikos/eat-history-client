import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  Bookmark,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  AudioLines,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import {
  createExtraDayChat,
  createFreeChat,
  deleteChat,
  generateSummary,
  getChat,
  getDailyChat,
  listConversations,
  renameChat,
  sendImageMessage,
  streamMessage,
  type ChatConversation,
  type ChatMessage,
} from './chat.api';
import { listAiModels } from '@/features/ai/ai.api';
import { useAuthStore } from '@/features/auth/auth.store';
import { useVoice } from '@/features/voice/VoiceContext';
import { useDictation } from '@/features/voice/useDictation';
import { Select } from '@/components/ui/Select';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import { cn } from '@/lib/cn';
import { PromptsSheet } from './PromptsSheet';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Etiqueta visible para una conversación. Para chats libres asociados a un
 * día (title con formato `__day#N`) se devuelve “Chat del {date} (N)”.
 */
function chatLabel(
  item: { kind: 'daily' | 'free'; date: string | null; title: string },
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  if (item.kind === 'daily' && item.date) return t('chat.dayChat', { date: item.date });
  const m = /^__day#(\d+)$/.exec(item.title);
  if (m && item.date) return `${t('chat.dayChat', { date: item.date })} (${m[1]})`;
  return item.title || t('chat.untitled');
}

const PRESET_KEYS = ['analyze', 'missing', 'improve', 'snack', 'recipe'] as const;

export function ChatPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();

  const dateParam = params.get('date');
  const idParam = params.get('id');

  // Mode: viewing a specific chat (daily by date OR free by id) vs. landing list
  const mode: 'daily' | 'chat' | 'list' = dateParam ? 'daily' : idParam ? 'chat' : 'list';

  // Resolve current chat
  const dailyQ = useQuery({
    queryKey: ['chat', 'daily', dateParam],
    queryFn: () => getDailyChat(dateParam!),
    enabled: mode === 'daily' && Boolean(dateParam),
  });
  const chatQ = useQuery({
    queryKey: ['chat', 'one', idParam],
    queryFn: () => getChat(idParam!),
    enabled: mode === 'chat' && Boolean(idParam),
  });
  const convo = (mode === 'daily' ? dailyQ.data : chatQ.data) as ChatConversation | undefined;

  // History list
  const historyQ = useQuery({
    queryKey: ['chat', 'list'],
    queryFn: () => listConversations(),
  });

  // Models for admin selector
  const modelsQ = useQuery({
    queryKey: ['ai', 'models'],
    queryFn: () => listAiModels(),
    enabled: isAdmin,
  });

  const [historyOpen, setHistoryOpen] = useState(false);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [text, setText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [modelOverride, setModelOverride] = useState<string | undefined>(undefined);
  const [creatingChat, setCreatingChat] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const voice = useVoice();
  const dictation = useDictation({
    locale: i18n.language.split('-')[0],
    onResult: (transcript) => {
      setText((prev) => (prev ? `${prev.trimEnd()} ${transcript}` : transcript));
      inputRef.current?.focus();
    },
    onError: (msg) => setError(msg),
  });

  const messages = useMemo<ChatMessage[]>(() => convo?.messages ?? [], [convo]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, streamBuffer]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Reset summary collapsed state when switching chats
  useEffect(() => {
    setSummaryOpen(false);
  }, [convo?.id]);

  // Image preview lifecycle
  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // Auto-resize textarea
  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = 'auto';
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`;
  }, [text]);

  const summaryMut = useMutation({
    mutationFn: () => generateSummary(convo!.id, modelOverride),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat'] });
    },
  });

  const renameMut = useMutation({
    mutationFn: () => renameChat(convo!.id, renameDraft),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat'] });
      setRenaming(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteChat(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'list'] }),
  });

  const createMut = useMutation({
    mutationFn: () => createFreeChat(createTitle.trim() || 'Chat'),
    onSuccess: (c) => {
      setCreatingChat(false);
      setCreateTitle('');
      qc.invalidateQueries({ queryKey: ['chat', 'list'] });
      setParams({ id: c.id });
    },
  });

  const extraDayMut = useMutation({
    mutationFn: (date: string) => createExtraDayChat(date),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['chat', 'list'] });
      setParams({ id: c.id });
    },
  });

  const imageMut = useMutation({
    mutationFn: ({ chatId, msg, file }: { chatId: string; msg: string; file: File }) =>
      sendImageMessage(chatId, msg, file, modelOverride),
    onSuccess: (c) => {
      const key = mode === 'daily' ? ['chat', 'daily', dateParam] : ['chat', 'one', idParam];
      qc.setQueryData(key, c);
      qc.invalidateQueries({ queryKey: ['chat', 'list'] });
    },
  });

  async function send(promptText?: string) {
    const value = (promptText ?? text).trim();
    if (!convo || streaming || imageMut.isPending) return;
    // Image branch: attached file always uses non-streaming endpoint
    if (imageFile) {
      const file = imageFile;
      setImageFile(null);
      setText('');
      setError(null);
      try {
        await imageMut.mutateAsync({ chatId: convo.id, msg: value, file });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error');
      }
      return;
    }
    if (!value) return;
    if (!promptText) setText('');
    setError(null);
    setStreamBuffer('');
    setStreaming(true);
    const ac = new AbortController();
    abortRef.current = ac;
    // Optimistic
    qc.setQueryData(
      mode === 'daily' ? ['chat', 'daily', dateParam] : ['chat', 'one', idParam],
      (prev: ChatConversation | undefined) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [
            ...prev.messages,
            { role: 'user' as const, content: value, createdAt: new Date().toISOString() },
          ],
        };
      },
    );
    let acc = '';
    await streamMessage(
      convo.id,
      value,
      modelOverride,
      {
        onDelta: (d) => {
          acc += d;
          setStreamBuffer(acc);
        },
        onError: (e) => setError(e),
      },
      ac.signal,
    );
    setStreaming(false);
    setStreamBuffer('');
    abortRef.current = null;
    if (mode === 'daily') dailyQ.refetch();
    else chatQ.refetch();
    qc.invalidateQueries({ queryKey: ['chat', 'list'] });
  }

  function openChat(item: { id: string; kind: 'daily' | 'free'; date: string | null }) {
    setHistoryOpen(false);
    if (item.kind === 'daily' && item.date) setParams({ date: item.date });
    else setParams({ id: item.id });
  }

  // ---- LIST mode ----
  if (mode === 'list') {
    return (
      <div className="flex flex-col gap-4">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{t('chat.title')}</h1>
          <button
            type="button"
            onClick={() => setCreatingChat(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {t('chat.newChat')}
          </button>
        </header>

        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => setParams({ date: todayISO() })}
            className="group flex flex-1 items-center gap-3 rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 text-left hover:border-primary/40"
          >
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{t('chat.openDayChat')}</p>
              <p className="text-xs text-muted-foreground">{t('chat.today')}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => extraDayMut.mutate(todayISO())}
            disabled={extraDayMut.isPending}
            className="grid w-12 flex-shrink-0 place-items-center rounded-2xl border border-dashed border-border bg-card/30 text-primary hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
            aria-label={t('chat.newDayChat')}
            title={t('chat.newDayChat')}
          >
            {extraDayMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </button>
        </div>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('chat.history')}
          </h2>
          {historyQ.isLoading ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : (historyQ.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">{t('chat.historyEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {historyQ.data!.map((h) => (
                <li
                  key={h.id}
                  className="flex min-w-0 items-start gap-3 rounded-xl border border-border bg-card/30 p-3"
                >
                  <button
                    type="button"
                    onClick={() => openChat(h)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium">
                        {chatLabel(h, t)}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {h.messageCount}
                      </span>
                    </div>
                    {h.lastMessage ? (
                      <p className="line-clamp-2 break-words text-xs text-muted-foreground">
                        {h.lastMessage}
                      </p>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({
                        title: t('common.deleteConfirmTitle'),
                        description: t('chat.deleteConfirm'),
                        destructive: true,
                        confirmText: t('common.delete'),
                      });
                      if (ok) deleteMut.mutate(h.id);
                    }}
                    className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-destructive hover:bg-destructive/10"
                    aria-label={t('chat.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {creatingChat ? (
          <BottomSheet onClose={() => setCreatingChat(false)} title={t('chat.newChatTitle')}>
            <input
              autoFocus
              type="text"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder={t('chat.namePlaceholder')}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && createTitle.trim()) createMut.mutate();
              }}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreatingChat(false)}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              >
                {t('chat.cancel')}
              </button>
              <button
                type="button"
                onClick={() => createMut.mutate()}
                disabled={!createTitle.trim() || createMut.isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {createMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t('chat.create')
                )}
              </button>
            </div>
          </BottomSheet>
        ) : null}
      </div>
    );
  }

  // ---- CHAT mode ----
  const chatModels = (modelsQ.data ?? []).filter((m) => m.capabilities?.includes('text'));
  const headerTitle = convo
    ? chatLabel({ kind: convo.kind, date: convo.date, title: convo.title }, t)
    : t('chat.untitled');

  return (
    <div className="-mx-4 flex h-[calc(100dvh-7rem)] flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/85 px-4 py-2 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate('/app/chat')}
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label="back"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {convo?.kind === 'daily' ? (
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
          ) : (
            <MessageCircle className="h-4 w-4 shrink-0 text-primary" />
          )}
          {renaming && convo?.kind === 'free' ? (
            <input
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onBlur={() => renameDraft.trim() && renameMut.mutate()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') renameMut.mutate();
                if (e.key === 'Escape') setRenaming(false);
              }}
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm font-semibold"
              placeholder={t('chat.renamePlaceholder')}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                if (convo?.kind !== 'free') return;
                setRenameDraft(convo.title);
                setRenaming(true);
              }}
              className={cn(
                'min-w-0 flex-1 truncate text-left text-sm font-semibold',
                convo?.kind === 'free' && 'hover:opacity-80',
              )}
              title={headerTitle}
            >
              {headerTitle}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isAdmin && chatModels.length > 0 ? (
            <Select
              value={modelOverride ?? ''}
              onValueChange={(v) => setModelOverride(v || undefined)}
              ariaLabel={t('chat.model')}
              triggerClassName="!py-1 !px-2 text-xs"
              options={[
                { value: '', label: t('chat.modelDefault') },
                ...chatModels.map((m) => ({
                  value: m.modelId,
                  label: m.displayName,
                  description: m.provider,
                })),
              ]}
            />
          ) : null}
          <button
            type="button"
            onClick={() =>
              voice.open({
                agent: 'chat',
                onChanged: () => {
                  qc.invalidateQueries({ queryKey: ['chat'] });
                },
              })
            }
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label={t('voice.startVoiceMode')}
            title={t('voice.startVoiceMode')}
          >
            <AudioLines className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => summaryMut.mutate()}
            disabled={summaryMut.isPending || messages.length === 0}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-40"
            aria-label={t('chat.generateSummary')}
            title={t('chat.generateSummary')}
          >
            {summaryMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label={t('chat.history')}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Summary banner (collapsible) */}
      {convo?.summary
        ? (() => {
            const summary = convo.summary;
            const PREVIEW_MAX = 90;
            const preview =
              summary.length > PREVIEW_MAX
                ? `${summary.slice(0, PREVIEW_MAX).trimEnd()}…`
                : summary;
            const canExpand = summary.length > PREVIEW_MAX;
            return (
              <div className="mx-3 mt-3 overflow-hidden rounded-xl border border-primary/30 bg-primary/5 text-sm sm:mx-4">
                <button
                  type="button"
                  onClick={() => setSummaryOpen((v) => !v)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs font-semibold text-primary"
                  aria-expanded={summaryOpen}
                >
                  <Sparkles className="mt-[2px] h-3.5 w-3.5 shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span>{t('chat.summary')}</span>
                    {!summaryOpen ? (
                      <span className="line-clamp-2 break-words text-[11px] font-normal text-foreground/80">
                        {preview}
                      </span>
                    ) : null}
                  </span>
                  {canExpand ? (
                    summaryOpen ? (
                      <ChevronUp className="mt-[2px] h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronDown className="mt-[2px] h-4 w-4 shrink-0" />
                    )
                  ) : null}
                </button>
                <AnimatePresence initial={false}>
                  {summaryOpen ? (
                    <motion.div
                      key="summary-body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                      <div className="whitespace-pre-wrap break-words px-3 pb-3 leading-relaxed text-foreground/90">
                        {summary}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })()
        : null}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4"
      >
        {messages.length === 0 && !streamBuffer ? (
          <EmptyState
            onPick={(prompt) => send(prompt)}
            onOpenPrompts={() => setPromptsOpen(true)}
            locale={i18n.language}
          />
        ) : (
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <MessageBubble
                  key={`${i}-${m.createdAt ?? ''}`}
                  role={m.role}
                  content={m.content}
                  imageUrl={m.imageUrl}
                />
              ))}
              {streamBuffer ? (
                <MessageBubble key="stream" role="assistant" content={streamBuffer} streaming />
              ) : streaming || imageMut.isPending ? (
                <motion.li
                  key="thinking"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('chat.thinking')}
                </motion.li>
              ) : null}
            </AnimatePresence>
          </ul>
        )}
        {error ? (
          <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
            {t('chat.errorPrefix')}: {error}
          </div>
        ) : null}
      </div>

      {/* Composer */}
      <form
        className="mx-3 mb-2 mt-1 sm:mx-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {imagePreview ? (
          <div className="mb-1.5 flex items-center gap-2 rounded-xl border border-border bg-muted/50 p-1.5">
            <img src={imagePreview} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {imageFile?.name}
            </span>
            <button
              type="button"
              onClick={() => setImageFile(null)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-background"
              aria-label={t('chat.removeImage')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        <div className="flex items-end gap-1 rounded-2xl border border-border bg-background p-1.5 shadow-sm focus-within:border-primary/50">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setImageFile(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label={t('chat.attachImage')}
            title={t('chat.attachImage')}
          >
            <ImagePlus className="h-4 w-4" />
          </button>
          {dictation.supported ? (
            <button
              type="button"
              onClick={() => dictation.toggle()}
              disabled={dictation.transcribing || streaming || imageMut.isPending}
              className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-full transition disabled:opacity-40',
                dictation.recording
                  ? 'bg-destructive text-destructive-foreground animate-pulse'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              aria-label={dictation.recording ? t('voice.dictateStop') : t('voice.dictateStart')}
              title={dictation.recording ? t('voice.dictateStop') : t('voice.dictateStart')}
            >
              {dictation.transcribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : dictation.recording ? (
                <Square className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
          ) : null}
          {!text.trim() && !imageFile && messages.length === 0 ? (
            <button
              type="button"
              onClick={() => setPromptsOpen(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label={t('chat.prompts.title')}
              title={t('chat.prompts.title')}
            >
              <Bookmark className="h-4 w-4" />
            </button>
          ) : null}
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('chat.placeholder')}
            rows={1}
            className="min-w-0 max-h-40 min-h-[2.25rem] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="submit"
            disabled={(!text.trim() && !imageFile) || streaming || imageMut.isPending}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition disabled:opacity-40"
            aria-label={t('chat.send')}
          >
            {streaming || imageMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>

      {/* History sheet */}
      {historyOpen ? (
        <BottomSheet onClose={() => setHistoryOpen(false)} title={t('chat.history')}>
          <button
            type="button"
            onClick={() => {
              setHistoryOpen(false);
              setCreatingChat(true);
              navigate('/app/chat');
            }}
            className="mb-2 flex w-full items-center gap-2 rounded-md border border-dashed border-border p-3 text-sm text-primary hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
            {t('chat.newChat')}
          </button>
          {historyQ.data?.length ? (
            <ul className="divide-y divide-border">
              {historyQ.data.map((h) => (
                <li key={h.id} className="flex min-w-0 items-start gap-2 py-1">
                  <button
                    type="button"
                    onClick={() => openChat(h)}
                    className="min-w-0 flex-1 rounded-md p-2 text-left text-sm hover:bg-muted"
                  >
                    <div className="truncate font-medium">{chatLabel(h, t)}</div>
                    {h.lastMessage ? (
                      <div className="line-clamp-2 break-words text-xs text-muted-foreground">
                        {h.lastMessage}
                      </div>
                    ) : null}
                  </button>
                  {h.kind === 'free' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryOpen(false);
                        setRenameDraft(h.title);
                        setParams({ id: h.id });
                        setRenaming(true);
                      }}
                      className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                      aria-label={t('chat.rename')}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({
                        title: t('common.deleteConfirmTitle'),
                        description: t('chat.deleteConfirm'),
                        destructive: true,
                        confirmText: t('common.delete'),
                      });
                      if (ok) deleteMut.mutate(h.id);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full text-destructive hover:bg-destructive/10"
                    aria-label={t('chat.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </BottomSheet>
      ) : null}

      {/* Prompts sheet */}
      {promptsOpen ? (
        <PromptsSheet
          onClose={() => setPromptsOpen(false)}
          onPick={(content) => {
            setPromptsOpen(false);
            setText((prev) => (prev ? `${prev}\n${content}` : content));
            inputRef.current?.focus();
          }}
        />
      ) : null}

      {/* Create chat from chat view */}
      {creatingChat ? (
        <BottomSheet onClose={() => setCreatingChat(false)} title={t('chat.newChatTitle')}>
          <input
            autoFocus
            type="text"
            value={createTitle}
            onChange={(e) => setCreateTitle(e.target.value)}
            placeholder={t('chat.namePlaceholder')}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreatingChat(false)}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              {t('chat.cancel')}
            </button>
            <button
              type="button"
              onClick={() => createMut.mutate()}
              disabled={!createTitle.trim() || createMut.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {createMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('chat.create')
              )}
            </button>
          </div>
        </BottomSheet>
      ) : null}
    </div>
  );
}

function MessageBubble({
  role,
  content,
  streaming,
  imageUrl,
}: {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  imageUrl?: string;
}) {
  const isUser = role === 'user';
  const [lightboxOpen, setLightboxOpen] = useState(false);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn('flex w-full min-w-0', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[88%] min-w-0 overflow-hidden whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
          isUser
            ? 'rounded-br-md bg-primary text-primary-foreground'
            : 'rounded-bl-md bg-muted text-foreground',
        )}
      >
        {imageUrl ? (
          <>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="group relative mb-1.5 block overflow-hidden rounded-lg"
              aria-label="Ver imagen"
            >
              <img
                src={imageUrl}
                alt=""
                className="max-h-64 w-auto max-w-full cursor-zoom-in object-cover transition group-hover:opacity-90"
              />
            </button>
            <ImageLightbox
              src={imageUrl}
              open={lightboxOpen}
              onClose={() => setLightboxOpen(false)}
            />
          </>
        ) : null}
        {content}
        {streaming ? (
          <span
            className="ml-0.5 inline-block w-[2px] animate-pulse bg-current align-baseline"
            style={{ height: '0.95em' }}
          />
        ) : null}
      </div>
    </motion.li>
  );
}

function EmptyState({
  onPick,
  onOpenPrompts,
  locale: _locale,
}: {
  onPick: (text: string) => void;
  onOpenPrompts: () => void;
  locale: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col justify-center gap-4 py-6">
      <div className="text-center">
        <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted-foreground">{t('chat.empty')}</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PRESET_KEYS.map((k) => {
          const txt = t(`chat.prompts.presets.${k}`);
          return (
            <button
              key={k}
              type="button"
              onClick={() => onPick(txt)}
              className="rounded-xl border border-border bg-card/30 p-3 text-left text-sm transition hover:border-primary/40 hover:bg-primary/5"
            >
              {txt}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onOpenPrompts}
        className="mx-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Bookmark className="h-3.5 w-3.5" />
        {t('chat.prompts.manage')}
      </button>
    </div>
  );
}

function BottomSheet({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end bg-black/40 sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-background p-4 shadow-2xl sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label="close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
