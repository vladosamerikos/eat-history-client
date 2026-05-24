import { useEffect, useRef } from 'react';

interface Props {
  /** AnalyserNode conectado a la pista de audio del agente. */
  analyser: AnalyserNode | null;
  /** Cuando es true se sigue dibujando con un fallback "ambiente" si no hay analyser. */
  active: boolean;
  /** Cantidad de barras a renderizar. */
  bars?: number;
  className?: string;
}

/**
 * Visualizador de audio reactivo estilo LiveKit BarVisualizer.
 * Lee `getByteFrequencyData()` del AnalyserNode y renderiza barras simétricas.
 * Si no hay analyser (aún no se ha conectado el agente) muestra una animación
 * ambient suave para indicar "esperando agente".
 */
export function VoiceVisualizer({ analyser, active, bars = 24, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const dataLen = analyser ? analyser.frequencyBinCount : 64;
    const data = new Uint8Array(dataLen);
    let t = 0;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      let values: number[];
      if (analyser && active) {
        analyser.getByteFrequencyData(data);
        // Tomamos las primeras `bars` bandas (más graves => más perceptibles).
        const step = Math.max(1, Math.floor((dataLen * 0.6) / bars));
        values = Array.from({ length: bars }, (_, i) => {
          let sum = 0;
          for (let j = 0; j < step; j += 1) sum += data[i * step + j] ?? 0;
          return sum / step / 255;
        });
      } else {
        // Ambient: ondas suaves senoidales para indicar "vivo"
        t += 0.03;
        values = Array.from({ length: bars }, (_, i) => {
          const v =
            0.18 +
            0.08 * Math.sin(t + i * 0.45) +
            0.05 * Math.sin(t * 1.7 + i * 0.9);
          return Math.max(0.05, v);
        });
      }

      const gap = 4;
      const barW = (w - gap * (bars - 1)) / bars;
      const cy = h / 2;
      const css = getComputedStyle(canvas);
      const primary = css.getPropertyValue('--primary').trim() || '210 90% 60%';
      ctx.fillStyle = `hsl(${primary})`;

      for (let i = 0; i < bars; i += 1) {
        const v = values[i] ?? 0;
        // Ease + curva campana (centro más alto)
        const center = bars / 2;
        const dist = Math.abs(i - center + 0.5) / center;
        const env = 1 - dist * dist * 0.5;
        const barH = Math.max(6, v * h * 0.95 * env);
        const x = i * (barW + gap);
        const y = cy - barH / 2;
        const r = Math.min(barW / 2, 6);
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, barW, barH, r);
        } else {
          ctx.rect(x, y, barW, barH);
        }
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [analyser, active, bars]);

  return <canvas ref={canvasRef} className={className} />;
}
