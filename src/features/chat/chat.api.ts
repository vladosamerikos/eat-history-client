import { api } from '@/lib/api';
import { env } from '@/config/env';
import { useAuthStore } from '@/features/auth/auth.store';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  modelUsed?: string;
  createdAt: string;
}

export type ChatKind = 'daily' | 'free';

export interface ChatConversation {
  id: string;
  kind: ChatKind;
  date: string | null;
  title: string;
  messages: ChatMessage[];
  summary: string;
  summaryAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatListItem {
  id: string;
  kind: ChatKind;
  date: string | null;
  title: string;
  messageCount: number;
  lastMessage: string;
  hasSummary: boolean;
  summaryAt?: string;
  updatedAt: string;
}

export interface ChatPrompt {
  id: string;
  title: string;
  content: string;
}

export const listConversations = () => api<ChatListItem[]>(`/chat`);
export const getDailyChat = (date: string) => api<ChatConversation>(`/chat/daily/${date}`);
export const createExtraDayChat = (date: string) =>
  api<ChatConversation>(`/chat/daily/${date}/extra`, { method: 'POST' });
export const getChat = (id: string) => api<ChatConversation>(`/chat/${id}`);
export const createFreeChat = (title: string) =>
  api<ChatConversation>(`/chat`, { method: 'POST', json: { title } });
export const renameChat = (id: string, title: string) =>
  api<ChatConversation>(`/chat/${id}`, { method: 'PATCH', json: { title } });
export const deleteChat = (id: string) => api<void>(`/chat/${id}`, { method: 'DELETE' });
export const generateSummary = (id: string, model?: string) =>
  api<{ summary: string; summaryAt: string }>(
    `/chat/${id}/summary${model ? `?model=${encodeURIComponent(model)}` : ''}`,
    { method: 'POST' },
  );

export const listPrompts = () => api<ChatPrompt[]>(`/chat/prompts`);
export const createPrompt = (title: string, content: string) =>
  api<ChatPrompt>(`/chat/prompts`, { method: 'POST', json: { title, content } });
export const updatePrompt = (id: string, patch: { title?: string; content?: string }) =>
  api<ChatPrompt>(`/chat/prompts/${id}`, { method: 'PATCH', json: patch });
export const deletePrompt = (id: string) => api<void>(`/chat/prompts/${id}`, { method: 'DELETE' });

export async function sendImageMessage(
  chatId: string,
  text: string,
  file: File,
  modelOverride?: string,
): Promise<ChatConversation> {
  const fd = new FormData();
  fd.append('file', file);
  if (text) fd.append('text', text);
  if (modelOverride) fd.append('modelOverride', modelOverride);
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${env.apiBaseUrl}/chat/${chatId}/messages-image`, {
    method: 'POST',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return (await res.json()) as ChatConversation;
}

export interface StreamCallbacks {
  onDelta: (delta: string) => void;
  onModel?: (modelUsed: string) => void;
  onDone?: () => void;
  onError?: (err: string) => void;
}

export async function streamMessage(
  chatId: string,
  text: string,
  modelOverride: string | undefined,
  cb: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${env.apiBaseUrl}/chat/${chatId}/messages`, {
    method: 'POST',
    credentials: 'include',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text, modelOverride }),
  });
  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '');
    cb.onError?.(`HTTP ${res.status}: ${errText}`);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const lines = raw.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        try {
          const ev = JSON.parse(data) as {
            delta?: string;
            modelUsed?: string;
            done?: boolean;
            error?: string;
          };
          if (ev.delta) cb.onDelta(ev.delta);
          if (ev.modelUsed) cb.onModel?.(ev.modelUsed);
          if (ev.error) cb.onError?.(ev.error);
          if (ev.done) cb.onDone?.();
        } catch {
          // ignored
        }
      }
    }
  }
}
