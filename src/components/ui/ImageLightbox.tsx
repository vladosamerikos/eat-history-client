import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

interface Props {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

/**
 * Visor a pantalla completa con:
 * - Botón lupa o doble-tap para alternar zoom
 * - Pinch-to-zoom con dos dedos en móvil (Pointer Events)
 * - Pan con un dedo cuando está ampliada
 */
export function ImageLightbox({ src, alt, open, onClose }: Props) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const touches = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTapAt = useRef(0);
  const [activeTouches, setActiveTouches] = useState(0);

  useEffect(() => {
    if (!open) return;
    setScale(1);
    setTx(0);
    setTy(0);
    touches.current.clear();
    pinchStart.current = null;
    panStart.current = null;
    setActiveTouches(0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const resetView = () => {
    setScale(1);
    setTx(0);
    setTy(0);
  };

  const toggleZoom = () => {
    if (scale > 1) resetView();
    else setScale(2);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setActiveTouches(touches.current.size);
    if (touches.current.size === 2) {
      const pts = Array.from(touches.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStart.current = { dist, scale };
      panStart.current = null;
    } else if (touches.current.size === 1 && scale > 1) {
      panStart.current = { x: e.clientX, y: e.clientY, tx, ty };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!touches.current.has(e.pointerId)) return;
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.current.size === 2 && pinchStart.current) {
      const pts = Array.from(touches.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const next = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, (pinchStart.current.scale * dist) / pinchStart.current.dist),
      );
      setScale(next);
      if (next === 1) {
        setTx(0);
        setTy(0);
      }
    } else if (touches.current.size === 1 && panStart.current && scale > 1) {
      setTx(panStart.current.tx + (e.clientX - panStart.current.x));
      setTy(panStart.current.ty + (e.clientY - panStart.current.y));
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    touches.current.delete(e.pointerId);
    setActiveTouches(touches.current.size);
    if (touches.current.size < 2) pinchStart.current = null;
    if (touches.current.size === 0) panStart.current = null;
  };

  const onImgTap = () => {
    const now = Date.now();
    if (now - lastTapAt.current < 280) {
      toggleZoom();
      lastTapAt.current = 0;
    } else {
      lastTapAt.current = now;
    }
  };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/90 p-4"
          onClick={() => {
            if (scale > 1) resetView();
            else onClose();
          }}
        >
          <div className="absolute right-3 top-3 z-[101] flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleZoom();
              }}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
              aria-label={scale > 1 ? 'Reducir' : 'Ampliar'}
            >
              {scale > 1 ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div
            className="relative flex h-full w-full select-none items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ touchAction: 'none' }}
          >
            <img
              src={src}
              alt={alt ?? ''}
              draggable={false}
              onClick={onImgTap}
              style={{
                transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
                transition: activeTouches === 0 ? 'transform 0.18s ease-out' : 'none',
                cursor: scale > 1 ? 'grab' : 'zoom-in',
                transformOrigin: 'center center',
                willChange: 'transform',
              }}
              className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
