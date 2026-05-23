import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Mic, MicOff, X } from 'lucide-react';
import {
  Room,
  RoomEvent,
  Track,
  type RemoteAudioTrack,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
  type LocalAudioTrack,
} from 'livekit-client';
import { useQueryClient } from '@tanstack/react-query';
import { createVoiceSession } from './voice.api';

type Status = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Cuando el agente termina o el usuario cierra: refrescar las queries de comidas. */
  onChanged?: () => void;
}

function pickLocale(lng: string): 'es' | 'en' | 'uk' {
  const base = lng.split('-')[0];
  if (base === 'es' || base === 'en' || base === 'uk') return base;
  return 'es';
}

export function VoiceDrawer({ open, onClose, onChanged }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [level, setLevel] = useState(0); // 0..1, nivel del micrófono
  const [agentSpeaking, setAgentSpeaking] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Conectar al abrir el drawer.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setStatus('connecting');
      setError(null);
      try {
        const session = await createVoiceSession(pickLocale(i18n.language));
        if (cancelled) return;

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        room.on(RoomEvent.Disconnected, () => {
          setStatus('ended');
          onChanged?.();
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

        await room.connect(session.livekitUrl, session.token);
        await room.localParticipant.setMicrophoneEnabled(true);

        // VU-meter del micrófono local.
        const micPub = Array.from(room.localParticipant.audioTrackPublications.values())[0];
        const localTrack = micPub?.track as LocalAudioTrack | undefined;
        const mediaStream = localTrack?.mediaStream;
        if (mediaStream) {
          const ctx = new AudioContext();
          audioCtxRef.current = ctx;
          const src = ctx.createMediaStreamSource(mediaStream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          src.connect(analyser);
          const buf = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            analyser.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i += 1) {
              const v = (buf[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / buf.length);
            setLevel(Math.min(1, rms * 3));
            rafRef.current = requestAnimationFrame(tick);
          };
          tick();
        }

        setStatus('connected');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      if (audioElRef.current) {
        audioElRef.current.remove();
        audioElRef.current = null;
      }
      const room = roomRef.current;
      roomRef.current = null;
      if (room) room.disconnect().catch(() => {});
    };
  }, [open, i18n.language, qc, onChanged]);

  const toggleMute = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  };

  const hangUp = () => {
    onChanged?.();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) hangUp();
          }}
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="flex w-full max-w-md flex-col rounded-t-3xl bg-background p-6 shadow-2xl sm:rounded-2xl"
          >
            <header className="mb-6 flex items-center justify-between">
              <h3 className="text-base font-semibold">{t('voice.title')}</h3>
              <button
                type="button"
                onClick={hangUp}
                className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                aria-label={t('voice.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex flex-col items-center gap-4 py-4">
              {/* Visualizador */}
              <div className="relative grid h-32 w-32 place-items-center">
                <motion.div
                  className="absolute inset-0 rounded-full bg-primary/15"
                  animate={{
                    scale: agentSpeaking ? [1, 1.15, 1] : 1 + level * 0.3,
                    opacity: agentSpeaking ? [0.5, 0.8, 0.5] : 0.4 + level * 0.4,
                  }}
                  transition={
                    agentSpeaking
                      ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
                      : { type: 'spring', stiffness: 200, damping: 20 }
                  }
                />
                <div className="relative grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground">
                  {status === 'connecting' ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : muted ? (
                    <MicOff className="h-8 w-8" />
                  ) : (
                    <Mic className="h-8 w-8" />
                  )}
                </div>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                {status === 'connecting' && t('voice.connecting')}
                {status === 'connected' && (agentSpeaking ? t('voice.agentSpeaking') : t('voice.listening'))}
                {status === 'ended' && t('voice.ended')}
                {status === 'error' && (error || t('voice.error'))}
              </p>

              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  disabled={status !== 'connected'}
                  onClick={toggleMute}
                  className="rounded-full border border-border bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/70 disabled:opacity-50"
                >
                  {muted ? t('voice.unmute') : t('voice.mute')}
                </button>
                <button
                  type="button"
                  onClick={hangUp}
                  className="rounded-full bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('voice.end')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
