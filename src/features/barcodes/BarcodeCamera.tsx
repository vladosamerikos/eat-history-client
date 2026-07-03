import { useEffect, useRef, useState } from 'react';
import { BrowserCodeReader, BrowserMultiFormatOneDReader } from '@zxing/browser';
import { CameraOff, Loader2 } from 'lucide-react';

interface Props {
  active: boolean;
  onDetected: (value: string) => void;
}

export function BarcodeCamera({ active, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const detectedRef = useRef(false);
  const readyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active || !videoRef.current) return undefined;
    detectedRef.current = false;
    readyRef.current = false;
    setError(null);
    setReady(false);
    const reader = new BrowserMultiFormatOneDReader(undefined, {
      delayBetweenScanAttempts: 120,
      delayBetweenScanSuccess: 700,
    });
    let stopped = false;
    let stop: (() => void) | undefined;
    const timeout = window.setTimeout(() => {
      if (!readyRef.current && !stopped) {
        setError('No se pudo iniciar la cámara. Puedes introducir el código manualmente.');
      }
    }, 8000);
    reader
      .decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result, _error, controls) => {
          if (!stop) stop = controls.stop;
          if (!result || detectedRef.current) return;
          const value = result.getText().trim();
          if (!/^\d{8,14}$/.test(value)) return;
          detectedRef.current = true;
          controls.stop();
          onDetected(value);
        },
      )
      .then((controls) => {
        window.clearTimeout(timeout);
        stop = controls.stop;
        if (stopped) controls.stop();
        else {
          readyRef.current = true;
          setReady(true);
        }
      })
      .catch((reason: unknown) => {
        window.clearTimeout(timeout);
        setError(reason instanceof Error ? reason.message : 'Camera unavailable');
      });
    return () => {
      stopped = true;
      window.clearTimeout(timeout);
      stop?.();
      BrowserCodeReader.releaseAllStreams();
    };
  }, [active, onDetected]);

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
      {!ready && !error && (
        <div className="absolute inset-0 grid place-items-center bg-black/60">
          <Loader2 className="h-7 w-7 animate-spin text-white" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 px-6 text-center text-white">
          <CameraOff className="h-7 w-7" />
          <p className="text-xs">{error}</p>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-[10%] top-1/2 h-28 -translate-y-1/2 rounded-xl border-2 border-primary shadow-[0_0_0_999px_rgba(0,0,0,0.2)]">
        <span className="absolute inset-x-4 top-1/2 h-0.5 bg-primary shadow-[0_0_10px_currentColor]" />
      </div>
    </div>
  );
}
