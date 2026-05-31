import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribeAudio } from '@/features/ai/ai.api';

type DictationState = 'idle' | 'recording' | 'transcribing';

interface UseDictationOptions {
  /** Idioma sugerido para la transcripción (ISO-639-1). */
  locale?: string;
  /** Se invoca con el texto transcrito cuando termina. */
  onResult: (text: string) => void;
  /** Se invoca si hay error de grabación o transcripción. */
  onError?: (message: string) => void;
}

interface UseDictation {
  state: DictationState;
  /** true mientras se está grabando. */
  recording: boolean;
  /** true mientras se transcribe en el backend. */
  transcribing: boolean;
  /** Indica si el navegador soporta grabación de audio. */
  supported: boolean;
  /** Inicia o detiene (y transcribe) la grabación. */
  toggle: () => void;
  /** Cancela la grabación sin transcribir. */
  cancel: () => void;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}

/**
 * Hook de dictado por voz: graba audio del micrófono y lo transcribe vía
 * backend (STT). Devuelve el texto por callback. Gestiona permisos, recursos
 * (stream/tracks) y estados de UI.
 */
export function useDictation({ locale, onResult, onError }: UseDictationOptions): UseDictation {
  const [state, setState] = useState<DictationState>('idle');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);

  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

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

  const start = useCallback(async () => {
    if (!supported) {
      onError?.('unsupported');
      return;
    }
    cancelledRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const tracks = streamRef.current?.getTracks() ?? [];
        tracks.forEach((tr) => tr.stop());
        streamRef.current = null;
        if (cancelledRef.current) {
          setState('idle');
          return;
        }
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        chunksRef.current = [];
        if (blob.size === 0) {
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
      };

      rec.start();
      setState('recording');
    } catch (e) {
      cleanup();
      setState('idle');
      onError?.(e instanceof Error ? e.message : String(e));
    }
  }, [supported, locale, onResult, onError, cleanup]);

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
