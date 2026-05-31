import { useCallback, useEffect, useRef, useState } from 'react';
import { env } from '@/config/env';
import { useAuthStore } from '@/features/auth/auth.store';
import { transcribeAudio } from '@/features/ai/ai.api';

type DictationState = 'idle' | 'recording' | 'transcribing';

interface UseDictationOptions {
  /** Idioma sugerido para la transcripción (ISO-639-1, p.ej. 'es'). */
  locale?: string;
  /** Transcripción parcial en vivo (finales + interim) mientras se habla. */
  onPartial?: (text: string) => void;
  /** Texto final completo cuando termina la sesión de dictado. */
  onResult: (text: string) => void;
  /** Se invoca si hay error de grabación o transcripción. */
  onError?: (message: string) => void;
}

interface UseDictation {
  state: DictationState;
  recording: boolean;
  transcribing: boolean;
  supported: boolean;
  toggle: () => void;
  cancel: () => void;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}

/** Construye la URL wss del gateway de STT a partir del apiBaseUrl. */
function buildSttUrl(locale: string, token: string): string {
  const base = env.apiBaseUrl;
  let origin: string;
  let prefix: string;
  if (/^https?:\/\//i.test(base)) {
    const u = new URL(base);
    origin = `${u.protocol === 'https:' ? 'wss:' : 'ws:'}//${u.host}`;
    prefix = u.pathname.replace(/\/$/, '');
  } else {
    origin = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    prefix = base.replace(/\/$/, '');
  }
  const sp = new URLSearchParams({ locale, token });
  return `${origin}${prefix}/stt/stream?${sp.toString()}`;
}

/**
 * Hook de dictado por voz con transcripción EN TIEMPO REAL.
 *
 * Estrategia: abre un WebSocket con el backend (`/v1/stt/stream`) que hace de
 * proxy hacia Google Cloud Speech streaming y devuelve resultados parciales.
 * El audio se captura con MediaRecorder (webm/opus) y se envía en chunks.
 * Si el WebSocket no está disponible, cae a transcripción por lotes (Gemini).
 */
export function useDictation({
  locale,
  onPartial,
  onResult,
  onError,
}: UseDictationOptions): UseDictation {
  const [state, setState] = useState<DictationState>('idle');

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const cancelledRef = useRef(false);
  const modeRef = useRef<'realtime' | 'batch'>('realtime');
  const finalRef = useRef('');
  const interimRef = useRef('');

  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    recorderRef.current = null;
    try {
      wsRef.current?.close();
    } catch {
      // ignored
    }
    wsRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const emitPartial = useCallback(() => {
    const live = `${finalRef.current} ${interimRef.current}`.replace(/\s+/g, ' ').trim();
    onPartial?.(live);
  }, [onPartial]);

  const finishBatch = useCallback(async () => {
    const rec = recorderRef.current;
    const blob = new Blob(chunksRef.current, { type: rec?.mimeType || 'audio/webm' });
    chunksRef.current = [];
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (cancelledRef.current || blob.size === 0) {
      setState('idle');
      return;
    }
    setState('transcribing');
    try {
      const { text } = await transcribeAudio({ blob, locale });
      if (text.trim()) onResult(text.trim());
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
    } finally {
      setState('idle');
    }
  }, [locale, onResult, onError]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    stop();
    cleanup();
    setState('idle');
  }, [stop, cleanup]);

  const startRecorder = useCallback(
    (stream: MediaStream, onChunk?: (data: Blob) => void, onStop?: () => void) => {
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size === 0) return;
        if (onChunk) onChunk(e.data);
        else chunksRef.current.push(e.data);
      };
      rec.onstop = () => onStop?.();
      // timeslice corto => baja latencia para streaming.
      rec.start(onChunk ? 250 : undefined);
      setState('recording');
    },
    [],
  );

  const start = useCallback(async () => {
    if (!supported) {
      onError?.('unsupported');
      return;
    }
    cancelledRef.current = false;
    finalRef.current = '';
    interimRef.current = '';
    const token = useAuthStore.getState().accessToken ?? '';

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
      return;
    }
    streamRef.current = stream;

    // Intentamos modo realtime vía WebSocket.
    let ws: WebSocket;
    try {
      ws = new WebSocket(buildSttUrl(locale ?? 'es', token));
    } catch {
      modeRef.current = 'batch';
      startRecorder(stream, undefined, () => void finishBatch());
      return;
    }
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;
    modeRef.current = 'realtime';

    const fallbackToBatch = (): void => {
      modeRef.current = 'batch';
      try {
        ws.close();
      } catch {
        // ignored
      }
      wsRef.current = null;
      if (recorderRef.current) return; // ya grabando
      startRecorder(stream, undefined, () => void finishBatch());
    };

    ws.onmessage = (ev) => {
      let msg: { type?: string; text?: string; isFinal?: boolean; message?: string };
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
      } catch {
        return;
      }
      if (msg.type === 'ready') {
        startRecorder(
          stream,
          (data) => {
            void data.arrayBuffer().then((buf) => {
              if (ws.readyState === WebSocket.OPEN) ws.send(buf);
            });
          },
          () => {
            // Al parar la grabación, avisamos al backend y esperamos finales.
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'stop' }));
            window.setTimeout(() => {
              if (!cancelledRef.current) {
                const finalText = `${finalRef.current} ${interimRef.current}`
                  .replace(/\s+/g, ' ')
                  .trim();
                if (finalText) onResult(finalText);
              }
              streamRef.current?.getTracks().forEach((tr) => tr.stop());
              streamRef.current = null;
              try {
                ws.close();
              } catch {
                // ignored
              }
              wsRef.current = null;
              setState('idle');
            }, 600);
          },
        );
        return;
      }
      if (msg.type === 'transcript' && typeof msg.text === 'string') {
        if (msg.isFinal) {
          finalRef.current = `${finalRef.current} ${msg.text}`.replace(/\s+/g, ' ').trim();
          interimRef.current = '';
        } else {
          interimRef.current = msg.text;
        }
        emitPartial();
        return;
      }
      if (msg.type === 'error') {
        if (!recorderRef.current) fallbackToBatch();
      }
    };

    ws.onerror = () => {
      if (!recorderRef.current && modeRef.current === 'realtime') fallbackToBatch();
    };

    ws.onclose = () => {
      if (!recorderRef.current && modeRef.current === 'realtime' && !cancelledRef.current) {
        fallbackToBatch();
      }
    };
  }, [supported, locale, onError, onResult, startRecorder, finishBatch, emitPartial]);

  const toggle = useCallback(() => {
    if (state === 'recording') stop();
    else if (state === 'idle') void start();
  }, [state, stop, start]);

  return {
    state,
    recording: state === 'recording',
    transcribing: state === 'transcribing',
    supported,
    toggle,
    cancel,
  };
}
