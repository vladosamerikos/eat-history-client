import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  ChevronDown,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Plus,
  Send,
  Settings as SettingsIcon,
  Volume2,
  VolumeX,
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
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import { PhotoSourceSheet } from '@/components/ui/PhotoSourceSheet';
import { createVoiceSession } from './voice.api';
import { useVoice } from './VoiceContext';
import { VoiceVisualizer } from './VoiceVisualizer';

type Status = 'idle' | 'connecting' | 'connected' | 'agent-waiting' | 'ended' | 'error';

interface ChatMessage {
  id: string;
  from: 'user' | 'agent';
  text: string;
  final: boolean;
  ts: number;
  photoUrl?: string;
}

interface DeviceOption {
  deviceId: string;
  label: string;
}

const URL_REGEX = /(https?:\/\/[^\s)]+)/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;

function pickLocale(lng: string): 'es' | 'en' | 'uk' {
  const base = lng.split('-')[0];
  if (base === 'es' || base === 'en' || base === 'uk') return base;
  return 'es';
}

/**
 * VoiceDrawer pantalla completa estilo Stitch:
 * - Header con transcripción en vivo + ajustes + cerrar.
 * - BarVisualizer reactivo al audio del agente.
 * - Chat con mensajes (agente izquierda, user derecha), foto en miniatura.
 * - Footer con input chat alineado + controles (mic / colgar / speaker).
 * - Settings sheet (input/output audio devices).
 * - Close-confirm sheet (minimizar vs colgar) cuando hay sesión activa.
 */
export function VoiceDrawer() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { isOpen, isMinimized, options, minimize, close } = useVoice();

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Visualizer
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  // Sheets
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [closeSheetOpen, setCloseSheetOpen] = useState(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Devices
  const [inputDevices, setInputDevices] = useState<DeviceOption[]>([]);
  const [outputDevices, setOutputDevices] = useState<DeviceOption[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>('');
  const [selectedOutputId, setSelectedOutputId] = useState<string>('');

  const roomRef = useRef<Room | null>(null);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // ---- Carga de devices ----
  const refreshDevices = useCallback(async () => {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      setInputDevices(
        devs
          .filter((d) => d.kind === 'audioinput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Microphone' })),
      );
      setOutputDevices(
        devs
          .filter((d) => d.kind === 'audiooutput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Speaker' })),
      );
    } catch {
      // ignored
    }
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    void refreshDevices();
  }, [settingsOpen, refreshDevices]);

  // ---- Lifecycle de la sala ----
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      setStatus('connecting');
      setError(null);
      setMessages([]);
      setAgentSpeaking(false);
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
          RoomEvent.ParticipantConnected,
          (p: RemoteParticipant) => {
            if (p.identity?.startsWith('agent')) {
              setStatus((prev) => (prev === 'agent-waiting' ? 'connected' : prev));
            }
          },
        );

        room.on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
            if (track.kind !== Track.Kind.Audio || !participant.identity.startsWith('agent')) return;
            const audio = track as RemoteAudioTrack;
            const el = audio.attach();
            el.autoplay = true;
            el.style.display = 'none';
            el.volume = speakerMuted ? 0 : 1;
            document.body.appendChild(el);
            audioElementsRef.current.push(el);

            // AnalyserNode reactivo a este track
            try {
              const ms = audio.mediaStreamTrack ? new MediaStream([audio.mediaStreamTrack]) : null;
              if (ms) {
                if (!audioCtxRef.current) {
                  const Ctx =
                    window.AudioContext ||
                    (window as unknown as { webkitAudioContext: typeof AudioContext })
                      .webkitAudioContext;
                  audioCtxRef.current = new Ctx();
                }
                const ctx = audioCtxRef.current;
                if (ctx.state === 'suspended') void ctx.resume();
                const source = ctx.createMediaStreamSource(ms);
                const node = ctx.createAnalyser();
                node.fftSize = 128;
                node.smoothingTimeConstant = 0.75;
                source.connect(node);
                setAnalyser(node);
              }
            } catch {
              // ignored
            }
            setStatus('connected');
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
                const urlMatch = seg.text.match(URL_REGEX);
                const photoUrl =
                  urlMatch && IMAGE_EXT.test(urlMatch[1]) ? urlMatch[1] : undefined;
                if (idx >= 0) {
                  next[idx] = { ...next[idx], text: seg.text, final: seg.final, photoUrl };
                } else {
                  next.push({
                    id: seg.id,
                    from,
                    text: seg.text,
                    final: seg.final,
                    ts: Date.now(),
                    photoUrl,
                  });
                }
              }
              return next;
            });
          },
        );

        await room.connect(session.livekitUrl, session.token);
        await room.localParticipant.setMicrophoneEnabled(true);

        // Si el agente aún no está en la sala, marcamos "esperando agente"
        const hasAgent = Array.from(room.remoteParticipants.values()).some((p) =>
          p.identity?.startsWith('agent'),
        );
        setStatus(hasAgent ? 'connected' : 'agent-waiting');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      for (const el of audioElementsRef.current) el.remove();
      audioElementsRef.current = [];
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setAnalyser(null);
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

  // ---- Acciones ----
  const toggleMute = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  };

  const toggleSpeaker = () => {
    const next = !speakerMuted;
    setSpeakerMuted(next);
    for (const el of audioElementsRef.current) {
      el.volume = next ? 0 : 1;
    }
  };

  const hangUp = useCallback(() => {
    options.onChanged?.();
    close();
  }, [options, close]);

  const onCloseClick = () => {
    if (status === 'connecting' || status === 'connected' || status === 'agent-waiting') {
      setCloseSheetOpen(true);
    } else {
      close();
    }
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
          photoUrl,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPhotoUploading(false);
    }
  };

  const onPickInputDevice = async (deviceId: string) => {
    setSelectedInputId(deviceId);
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.switchActiveDevice('audioinput', deviceId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onPickOutputDevice = async (deviceId: string) => {
    setSelectedOutputId(deviceId);
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.switchActiveDevice('audiooutput', deviceId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // ---- Transcripción en vivo (último segmento del agente) ----
  const liveTranscript = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.from === 'agent') return m.text;
    }
    return '';
  }, [messages]);

  const statusLabel = useMemo(() => {
    if (status === 'connecting') return t('voice.connecting');
    if (status === 'agent-waiting') return t('voice.waitingAgent') ?? t('voice.connecting');
    if (status === 'ended') return t('voice.ended');
    if (status === 'error') return error || t('voice.error');
    if (agentSpeaking) return t('voice.agentSpeaking');
    return t('voice.listening');
  }, [status, agentSpeaking, error, t]);

  return (
    <>
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
            <header className="relative z-10 flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={minimize}
                className="grid h-10 w-10 place-items-center rounded-full bg-surface-container text-on-surface-variant hover:text-on-background"
                aria-label={t('voice.minimize') ?? 'Minimizar'}
              >
                <ChevronDown className="h-5 w-5" />
              </button>
              <h1 className="text-lg font-bold">{t('voice.title')}</h1>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="grid h-10 w-10 place-items-center rounded-full bg-surface-container text-on-surface-variant hover:text-on-background"
                  aria-label={t('voice.settings') ?? 'Ajustes'}
                >
                  <SettingsIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={onCloseClick}
                  className="grid h-10 w-10 place-items-center rounded-full bg-surface-container text-on-surface-variant hover:text-on-background"
                  aria-label={t('voice.close')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            {/* Status + live transcript (above visualizer, separated from chat) */}
            <div className="relative z-10 mt-4 px-6 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                {statusLabel}
                {muted && status === 'connected' && (
                  <span className="ml-2 text-on-surface-variant/70">
                    · {t('voice.mutedHint') ?? 'micro silenciado'}
                  </span>
                )}
              </p>
              <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm font-medium text-on-background/90">
                {liveTranscript ||
                  (status === 'connected' || status === 'agent-waiting'
                    ? (t('voice.chatHint') ?? 'Habla o escribe para empezar.')
                    : '')}
              </p>
            </div>

            {/* Visualizer */}
            <div className="relative z-10 mt-2 h-32 w-full px-8">
              {status === 'error' ? (
                <div className="flex h-full items-center justify-center text-destructive">
                  <AlertCircle className="mr-2 h-5 w-5" />
                  <span className="text-sm">{error ?? t('voice.error')}</span>
                </div>
              ) : status === 'connecting' || status === 'agent-waiting' ? (
                <div className="flex h-full items-center justify-center gap-2 text-on-surface-variant">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm">
                    {status === 'agent-waiting'
                      ? (t('voice.waitingAgent') ?? 'Esperando al agente…')
                      : (t('voice.connecting') ?? 'Conectando…')}
                  </span>
                </div>
              ) : (
                <VoiceVisualizer
                  analyser={analyser}
                  active={agentSpeaking}
                  className="h-full w-full"
                />
              )}
            </div>

            {/* Chat area */}
            <div
              ref={scrollerRef}
              className="chat-mask relative z-10 flex-1 space-y-3 overflow-y-auto px-5 py-4"
            >
              {messages.length === 0 && status === 'connected' && (
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
                        ? `max-w-[80%] space-y-2 rounded-xl rounded-tr-none bg-primary-container px-4 py-2.5 text-sm text-on-primary-container ${
                            !m.final ? 'opacity-70 italic' : ''
                          }`
                        : `max-w-[80%] space-y-2 rounded-xl rounded-tl-none border border-outline-variant/30 bg-surface-container-high px-4 py-2.5 text-sm text-on-surface ${
                            !m.final ? 'opacity-70 italic' : ''
                          }`
                    }
                  >
                    {m.photoUrl && (
                      <button
                        type="button"
                        onClick={() => setLightboxUrl(m.photoUrl!)}
                        className="block overflow-hidden rounded-lg border border-outline-variant/30"
                        aria-label={t('voice.openPhoto') ?? 'Ver foto'}
                      >
                        <img
                          src={m.photoUrl}
                          alt=""
                          className="h-40 w-40 object-cover transition-transform hover:scale-105"
                        />
                      </button>
                    )}
                    {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
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
            <footer className="relative z-10 border-t border-outline-variant/20 bg-surface-container-lowest/80 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
              {/* Text input row */}
              <div className="mb-4 flex items-end gap-2 rounded-2xl border border-outline-variant/50 bg-surface-container px-2 py-2">
                <button
                  type="button"
                  onClick={() => setPhotoSheetOpen(true)}
                  disabled={status !== 'connected' || photoUploading}
                  className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-background disabled:opacity-40"
                  aria-label={t('meals.photo.takeOrUpload') ?? 'Añadir foto'}
                  title={t('meals.photo.takeOrUpload') ?? 'Añadir foto'}
                >
                  {photoUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </button>
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
                  className="max-h-24 min-h-[2.5rem] flex-1 resize-none self-center bg-transparent px-2 py-2 text-sm text-on-background placeholder:text-on-surface-variant/60 focus:outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={sendText}
                  disabled={inputDisabled || !draft.trim()}
                  className="btn-press grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition disabled:opacity-40"
                  aria-label={t('common.send') ?? 'Enviar'}
                >
                  {sending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
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
                  onClick={toggleSpeaker}
                  className="btn-press grid h-14 w-14 place-items-center rounded-full border border-outline-variant/30 bg-surface-container text-on-surface hover:bg-surface-container-high"
                  aria-label={
                    speakerMuted
                      ? (t('voice.unmuteSpeaker') ?? 'Activar altavoz')
                      : (t('voice.muteSpeaker') ?? 'Silenciar altavoz')
                  }
                  title={
                    speakerMuted
                      ? (t('voice.unmuteSpeaker') ?? 'Activar altavoz')
                      : (t('voice.muteSpeaker') ?? 'Silenciar altavoz')
                  }
                >
                  {speakerMuted ? (
                    <VolumeX className="h-6 w-6" />
                  ) : (
                    <Volume2 className="h-6 w-6" />
                  )}
                </button>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox de foto */}
      <ImageLightbox
        src={lightboxUrl ?? ''}
        open={!!lightboxUrl}
        onClose={() => setLightboxUrl(null)}
      />

      {/* Selector de origen para adjuntar foto */}
      <PhotoSourceSheet
        open={photoSheetOpen}
        onClose={() => setPhotoSheetOpen(false)}
        onFile={(f) => void sendPhotoToAgent(f)}
        accept="image/jpeg,image/png,image/webp"
      />

      {/* Close confirm sheet */}
      <AnimatePresence>
        {closeSheetOpen && (
          <motion.div
            key="close-sheet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCloseSheetOpen(false)}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md overflow-hidden rounded-t-3xl bg-surface pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-2"
            >
              <div className="px-5 py-4 text-center">
                <h3 className="text-sm font-semibold text-on-background">
                  {t('voice.closeTitle') ?? '¿Cerrar el asistente?'}
                </h3>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {t('voice.closeDescription') ?? 'Puedes minimizarlo para seguir hablando luego.'}
                </p>
              </div>
              <div className="grid divide-y divide-outline-variant/30 border-y border-outline-variant/30 bg-surface-container">
                <button
                  type="button"
                  onClick={() => {
                    setCloseSheetOpen(false);
                    minimize();
                  }}
                  className="flex items-center gap-3 px-5 py-4 text-left text-sm font-medium text-on-background hover:bg-surface-container-high"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                    <ChevronDown className="h-5 w-5" />
                  </span>
                  {t('voice.minimize') ?? 'Minimizar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCloseSheetOpen(false);
                    hangUp();
                  }}
                  className="flex items-center gap-3 px-5 py-4 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-destructive/10 text-destructive">
                    <PhoneOff className="h-5 w-5" />
                  </span>
                  {t('voice.end') ?? 'Finalizar sesión'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setCloseSheetOpen(false)}
                className="block w-full px-5 py-3 text-center text-sm font-medium text-on-surface-variant hover:bg-surface-container-low"
              >
                {t('common.cancel') ?? 'Cancelar'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings sheet */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            key="settings-sheet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSettingsOpen(false)}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md overflow-hidden rounded-t-3xl bg-surface pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-2"
            >
              <div className="flex items-center justify-between px-5 py-4">
                <h3 className="text-base font-semibold text-on-background">
                  {t('voice.settings') ?? 'Ajustes de audio'}
                </h3>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-surface-container text-on-surface-variant"
                  aria-label={t('common.close') ?? 'Cerrar'}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 px-5 pb-4">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {t('voice.inputDevice') ?? 'Micrófono'}
                  </label>
                  <select
                    value={selectedInputId}
                    onChange={(e) => void onPickInputDevice(e.target.value)}
                    className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container px-3 text-sm text-on-background focus:border-primary focus:outline-none"
                  >
                    <option value="">{t('voice.defaultDevice') ?? 'Predeterminado'}</option>
                    {inputDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {t('voice.outputDevice') ?? 'Altavoz'}
                  </label>
                  <select
                    value={selectedOutputId}
                    onChange={(e) => void onPickOutputDevice(e.target.value)}
                    className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container px-3 text-sm text-on-background focus:border-primary focus:outline-none"
                  >
                    <option value="">{t('voice.defaultDevice') ?? 'Predeterminado'}</option>
                    {outputDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  {outputDevices.length === 0 && (
                    <p className="mt-1 text-[11px] text-on-surface-variant">
                      {t('voice.outputDeviceUnsupported') ??
                        'Tu navegador no permite cambiar el altavoz.'}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
