import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface PhotoViewerProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

export function PhotoViewer({ src, alt = '', onClose }: PhotoViewerProps) {
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [src, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {src && (
        <motion.div
          key="photo-viewer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[9999] flex flex-col bg-black/95"
        >
          <TransformWrapper
            initialScale={1}
            minScale={1}
            maxScale={6}
            doubleClick={{ mode: 'toggle', step: 2 }}
            wheel={{ step: 0.2 }}
            pinch={{ step: 5 }}
            limitToBounds
            centerOnInit
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
                  <button
                    type="button"
                    onClick={onClose}
                    className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => zoomOut()}
                      className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
                      aria-label="Zoom out"
                    >
                      <ZoomOut className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => zoomIn()}
                      className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
                      aria-label="Zoom in"
                    >
                      <ZoomIn className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => resetTransform()}
                      className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
                      aria-label="Reset"
                    >
                      <RotateCcw className="h-5 w-5" />
                    </button>
                  </div>
                </header>
                <TransformComponent
                  wrapperStyle={{ width: '100%', height: '100%' }}
                  contentStyle={{ width: '100%', height: '100%' }}
                >
                  <img
                    src={src}
                    alt={alt}
                    draggable={false}
                    className="h-full w-full select-none object-contain"
                  />
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
          <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[11px] text-white/60">
            Pellizca o doble toque para zoom
          </p>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
