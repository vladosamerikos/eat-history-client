import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  createPrompt,
  deletePrompt,
  listPrompts,
  updatePrompt,
  type ChatPrompt,
} from './chat.api';

interface Props {
  onClose: () => void;
  onPick: (content: string) => void;
}

export function PromptsSheet({ onClose, onPick }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const promptsQ = useQuery({ queryKey: ['chat', 'prompts'], queryFn: listPrompts });
  const [editing, setEditing] = useState<ChatPrompt | null>(null);
  const [creating, setCreating] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [contentInput, setContentInput] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['chat', 'prompts'] });

  const createMut = useMutation({
    mutationFn: () => createPrompt(titleInput.trim(), contentInput.trim()),
    onSuccess: () => {
      setCreating(false);
      setTitleInput('');
      setContentInput('');
      refresh();
    },
  });
  const updateMut = useMutation({
    mutationFn: () =>
      updatePrompt(editing!.id, { title: titleInput.trim(), content: contentInput.trim() }),
    onSuccess: () => {
      setEditing(null);
      setTitleInput('');
      setContentInput('');
      refresh();
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePrompt(id),
    onSuccess: refresh,
  });

  const startEdit = (p: ChatPrompt) => {
    setEditing(p);
    setTitleInput(p.title);
    setContentInput(p.content);
    setCreating(false);
  };
  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setTitleInput('');
    setContentInput('');
  };
  const cancelForm = () => {
    setCreating(false);
    setEditing(null);
    setTitleInput('');
    setContentInput('');
  };

  const showForm = creating || editing;

  return (
    <div
      className="fixed inset-0 z-30 flex items-end bg-black/40 sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-background p-4 shadow-2xl sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t('chat.prompts.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {showForm ? (
          <div className="space-y-2 rounded-xl border border-border p-3">
            <input
              autoFocus
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder={t('chat.prompts.promptName')}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <textarea
              value={contentInput}
              onChange={(e) => setContentInput(e.target.value)}
              placeholder={t('chat.prompts.promptContent')}
              rows={3}
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelForm}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              >
                {t('chat.cancel')}
              </button>
              <button
                type="button"
                disabled={
                  !titleInput.trim() ||
                  !contentInput.trim() ||
                  createMut.isPending ||
                  updateMut.isPending
                }
                onClick={() => (editing ? updateMut.mutate() : createMut.mutate())}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {(createMut.isPending || updateMut.isPending) && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                {t('chat.prompts.save')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={startCreate}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border p-2.5 text-sm text-primary hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
            {t('chat.prompts.add')}
          </button>
        )}

        <div className="mt-3 space-y-2">
          {promptsQ.isLoading ? (
            <p className="text-xs text-muted-foreground">…</p>
          ) : (promptsQ.data?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">{t('chat.prompts.empty')}</p>
          ) : (
            promptsQ.data!.map((p) => (
              <div
                key={p.id}
                className="flex items-start gap-2 rounded-xl border border-border bg-card/30 p-2.5"
              >
                <button
                  type="button"
                  onClick={() => onPick(p.content)}
                  className="flex-1 text-left"
                >
                  <p className="text-sm font-medium">{p.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{p.content}</p>
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                  aria-label={t('chat.rename')}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: t('common.deleteConfirmTitle'),
                      description: t('chat.prompts.deleteConfirm'),
                      destructive: true,
                      confirmText: t('common.delete'),
                    });
                    if (ok) deleteMut.mutate(p.id);
                  }}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-destructive hover:bg-destructive/10"
                  aria-label={t('chat.delete')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Hook to save text as prompt with a quick prompt() flow. */
export function useSavePrompt() {
  const qc = useQueryClient();
  return (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const title = window.prompt('Título del prompt', trimmed.slice(0, 40));
    if (!title || !title.trim()) return;
    createPrompt(title.trim(), trimmed)
      .then(() => qc.invalidateQueries({ queryKey: ['chat', 'prompts'] }))
      .catch(() => undefined);
  };
}
