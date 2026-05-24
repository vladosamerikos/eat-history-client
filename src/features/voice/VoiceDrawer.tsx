import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Plus,
  Send,
  Volume2,
  X,
} from 'lucide-react';
import {
  Room,
  RoomEvent,
  Track,
  type RemoteAudioTrack,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
  type TranscriptionSegment,
  type Participant,
} from 'livekit-client';
import { useQueryClient } from '@tanstack/react-query';
import { uploadStandalonePhoto } from '@/features/meals/meals.api';
import { createVoiceSession } from './voice.api';
import { useVoice } from './VoiceContext';

type Status = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

interface ChatMessage {
  id: string;
  from: 'user' | 'agent';
  text: string;
  final: boolean;
  ts: number;
}

function pickLocale(lng: string): 'es' | 'en' | 'uk' {
  const base = lng.split('-')[0];
  if (base === 'es' || base === 'en' || base === 'uk') return base;
  return 'es';
}

/**
 * VoiceDrawer pantalla completa estilo Stitch:
 * - Header con título + minimizar + cerrar.
 * - Wave visualizer SVG (3 paths animados con CSS keyframes).
 * - Chat con mensajes (agente izquierda, user derecha) y máscara de fade.
 * - Footer con input redondeado + fila de controles (mic / colgar / volumen).
 *
 * Mantiene LiveKit + TranscriptionReceived + sendText topic 'lk.chat' +
 * estado de mute + minimizar (deja la Room viva).
 */
export function VoiceDrawer() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { isOpen, isMinimized, options, minimize, close } = useVoice();

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      setStatus('connecting');
      setError(null);
      setMessages([]);
      try {
        const session = await createVoiceSession(pickLocale(i18n.language), options.photoUrl);
        if (cancelled) return;

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        room.on(RoomEvent.Disconnected, () => {
          setStatus('ended');
          options.onChanged?.();
          qc.invalidateQueries({ queryKey: ['meals'] });
          qc.invalidateQueries({ queryKey: ['weights'] });
        });

        room.on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
            if (track.kind === Track.Kind.Audio && participant.identity.startsWith('agent')) {
              const audio = track as RemoteAudioTrack;
              const el = audio.attach();
              el.autoplay = true;
              el.style.display = 'none';
              document.body.appendChild(el);
              audioElRef.current = el;
            }
          },
        );

        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          const agent = speakers.find((s) => s.identity?.startsWith('agent'));
          setAgentSpeaking(!!agent);
        });

        room.on(
          RoomEvent.TranscriptionReceived,
          (segments: TranscriptionSegment[], participant?: Participant) => {
            const from: 'user' | 'agent' = participant?.identity?.startsWith('agent')
              ? 'agent'
              : 'user';
            setMessages((prev) => {
              const next = [...prev];
              for (const seg of segments) {
                const idx = next.findIndex((m) => m.id === seg.id);
                if (idx >= 0) {
                  next[idx] = { ...next[idx], text: seg.text, final: seg.final };
                } else {
                  next.push({
                    id: seg.id,
                    from,
                    text: seg.text,
                    final: seg.final,
                    ts: Date.now(),
                  });
                }
              }
              return next;
            });
          },
        );

        await room.connect(session.livekitUrl, session.token);
        await room.localParticipant.setMicrophoneEnabled(true);

        setStatus('connected');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      if (audioElRef.current) {
        audioElRef.current.remove();
        audioElRef.current = null;
      }
      const room = roomRef.current;
      roomRef.current = null;
      if (room) room.disconnect().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const toggleMute = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  };

  const hangUp = () => {
    options.onChanged?.();
    close();
  };

  const sendText = async () => {
    const text = draft.trim();
    if (!text || sending || agentSpeaking) return;
    const room = roomRef.current;
    if (!room || status !== 'connected') return;
    setSending(true);
    try {
      await room.localParticipant.sendText(text, { topic: 'lk.chat' });
      setMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, from: 'user', text, final: true, ts: Date.now() },
      ]);
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const inputDisabled = status !== 'connected' || agentSpeaking || sending;

  const sendPhotoToAgent = async (file: File) => {
    const room = roomRef.current;
    if (!room || status !== 'connected' || photoUploading) return;
    setPhotoUploading(true);
    try {
      const { photoUrl } = await uploadStandalonePhoto(file);
      const announce =
        t('voice.photoAnnounce', { url: photoUrl }) ??
        `He adjuntado una foto de mi plato. Analízala y regístrala: ${photoUrl}`;
      await room.localParticipant.sendText(announce, { topic: 'lk.chat' });
      setMessages((prev) => [
        ...prev,
        {
          id: `user-photo-${Date.now()}`,
          from: 'user',
          text: t('voice.photoSent') ?? '📷 Foto adjuntada',
          final: true,
          ts: Date.now(),
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPhotoUploading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && !isMinimized && (
        <motion.div
          key="voice-drawer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex flex-col bg-background text-on-background"
        >
          {/* Atmospheric blobs */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-32 bottom-40 h-72 w-72 rounded-full bg-primary-container/10 blur-3xl"
          />

          {/* Header */}
          <header className="relative z-10 flex items-center justify-between px-5 py-4">
            <button
              type="button"
              onClick={minimize}
              className="grid h-10 w-10 place-items-center rounded-full bg-surface-container text-on-surface-variant hover:text-on-background"
              aria-label={t('voice.minimize') ?? 'Minimizar'}
            >
              <ChevronDown className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold">{t('voice.title')}</h1>
            <button
              type="button"
              onClick={hangUp}
              className="grid h-10 w-10 place-items-center rounded-full bg-surface-container text-on-surface-variant hover:text-on-background"
              aria-label={t('voice.close')}
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          {/* Wave visualizer */}
          <div className="relative z-10 h-40 w-full px-5">
            <div className="relative h-full w-full overflow-hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 m-auto h-32 w-32 rounded-full bg-primary/20 blur-2xl"
                style={{ opacity: agentSpeaking ? 0.9 : 0.4 }}
              />
              <svg
                viewBox="0 0 400 160"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
              >
                <defs>
                  <linearGradient id="waveGrad" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                    <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="1" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  className="wave-path animate-wave-slow"
                  d="M 0,80 Q 100,20 200,80 T 400,80"
                  stroke="url(#waveGrad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.9"
                />
                <path
                  className="wave-path animate-wave-medium"
                  d="M 0,80 Q 100,140 200,80 T 400,80"
                  stroke="url(#waveGrad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.6"
                />
                <path
                  className="wave-path animate-wave-fast"
                  d="M 0,80 Q 100,50 200,80 T 400,80"
                  stroke="url(#waveGrad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.35"
                />
              </svg>
            </div>
            <p className="mt-2 text-center text-xs font-medium text-on-surface-variant">
              {status === 'connecting' && t('voice.connecting')}
              {status === 'connected' && (agentSpeaking ? t('voice.agentSpeaking') : t('voice.listening'))}
              {status === 'ended' && t('voice.ended')}
              {status === 'error' && (error || t('voice.error'))}
              {muted && status === 'connected' && (
                <span className="ml-2 text-on-surface-variant/70">· {t('voice.mutedHint') ?? 'micro silenciado'}</span>
              )}
            </p>
          </div>

          {/* Chat area */}
          <div
            ref={scrollerRef}
            className="chat-mask relative z-10 flex-1 space-y-3 overflow-y-auto px-5 py-4"
          >
            {status === 'connected' && messages.length === 0 && (
              <p className="py-6 text-center text-xs text-on-surface-variant">
                {t('voice.chatHint') ?? 'Habla o escribe para empezar.'}
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`message-entrance flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={
                    m.from === 'user'
                      ? `max-w-[80%] rounded-xl rounded-tr-none bg-primary-container px-4 py-2.5 text-sm text-on-primary-container ${
                          !m.final ? 'opacity-70 italic' : ''
                        }`
                      : `max-w-[80%] rounded-xl rounded-tl-none border border-outline-variant/30 bg-surface-container-high px-4 py-2.5 text-sm text-on-surface ${
                          !m.final ? 'opacity-70 italic' : ''
                        }`
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}
            {agentSpeaking && (
              <div className="flex justify-start">
                <div className="rounded-xl rounded-tl-none border border-outline-variant/30 bg-surface-container-high px-4 py-2.5">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    <span
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
                      style={{ animationDelay: '120ms' }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
                      style={{ animationDelay: '240ms' }}
                    />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="relative z-10 border-t border-outline-variant/20 bg-surface-container-lowest/80 px-5 py-4 backdrop-blur-xl">
            {/* Text input row */}
            <div className="mb-3 flex items-center gap-2 rounded-full border border-outline-variant/50 bg-surface-container px-2 py-1.5">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={status !== 'connected' || photoUploading}
                className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-background disabled:opacity-40"
                aria-label={t('meals.photo.takeOrUpload') ?? 'Añadir foto'}
                title={t('meals.photo.takeOrUpload') ?? 'Añadir foto'}
              >
                {photoUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Plus className="h-5 w-5" />
                )}
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void sendPhotoToAgent(f);
                }}
              />
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendText();
                  }
                }}
                disabled={inputDisabled}
                placeholder={
                  agentSpeaking
                    ? (t('voice.sendDisabledSpeaking') ?? 'Espera a que termine de hablar…')
                    : (t('voice.typeMessage') ?? 'Escribe un mensaje…')
                }
                className="max-h-24 min-h-[2.25rem] flex-1 resize-none bg-transparent px-1 py-1 text-sm text-on-background placeholder:text-on-surface-variant/60 focus:outline-none disabled:opacity-60"
              />
              <button
                type="button"
                onClick={sendText}
                disabled={inputDisabled || !draft.trim()}
                className="btn-press grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition disabled:opacity-40"
                aria-label={t('common.send') ?? 'Enviar'}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                disabled={status !== 'connected'}
                onClick={toggleMute}
                className="btn-press grid h-14 w-14 place-items-center rounded-full border border-outline-variant/30 bg-surface-container text-on-surface transition hover:bg-surface-container-high disabled:opacity-50"
                aria-label={muted ? (t('voice.unmute') ?? 'Activar') : (t('voice.mute') ?? 'Silenciar')}
              >
                {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </button>
              <button
                type="button"
                onClick={hangUp}
                className="btn-press grid h-16 w-16 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition hover:opacity-90"
                aria-label={t('voice.end')}
              >
                <PhoneOff className="h-7 w-7" />
              </button>
              <button
                type="button"
                className="btn-press grid h-14 w-14 place-items-center rounded-full border border-outline-variant/30 bg-surface-container text-on-surface hover:bg-surface-container-high"
                aria-label={t('voice.volume') ?? 'Volumen'}
              >
                <Volume2 className="h-6 w-6" />
              </button>
            </div>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
