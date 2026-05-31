import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, ScanLine, X } from 'lucide-react';
import { ImageLightbox } from './ImageLightbox';

interface Props {
  previewUrl?: string | null;
  onPick: () => void;
  onRemove: () => void;
  /** Etiqueta del botón vacío (ej. "Añadir foto"). */
  emptyLabel?: string;
  /** Icono mostrado en el estado vacío. */
  emptyIcon?: ReactNode;
  /** Acción extra alineada a la izquierda en estado lleno (ej. botón IA). */
  extraAction?: ReactNode;
  /** Permite abrir la foto en lightbox al pulsar la imagen. */
  enableLightbox?: boolean;
  /** Altura/ratio del placeholder vacío. */
  placeholderClass?: string;
}

/**
 * Card de foto reutilizable. Muestra la imagen con botones flotantes
 * (cambiar/quitar) o un placeholder cliclable cuando no hay foto.
 * Opcionalmente abre lightbox al pulsar la foto.
 */
export function PhotoCard({
  previewUrl,
  onPick,
  onRemove,
  emptyLabel,
  emptyIcon,
  extraAction,
  enableLightbox = true,
  placeholderClass = 'h-32',
}: Props) {
  const { t } = useTranslation();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (previewUrl) {
    return (
      <>
        <div className="ai-glow relative overflow-hidden rounded-xl">
          <button
            type="button"
            onClick={() => enableLightbox && setLightboxOpen(true)}
            className="block w-full"
            aria-label={t('common.viewPhoto') ?? 'Ver foto'}
          >
            <img src={previewUrl} alt="" className="aspect-video w-full object-cover" />
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-3">
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onPick}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-container/90 px-3 text-xs font-semibold text-on-surface backdrop-blur hover:bg-surface-container-high"
              >
                <Camera className="h-3.5 w-3.5" />
                {t('common.changePhoto') ?? 'Cambiar'}
              </button>
              {extraAction}
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-surface-container/90 text-on-surface backdrop-blur hover:bg-surface-container-high"
              aria-label={t('common.removePhoto') ?? 'Quitar'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {enableLightbox && (
          <ImageLightbox
            src={previewUrl}
            open={lightboxOpen}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={onPick}
      className={`ai-glow group glass-panel relative flex w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl p-4 ${placeholderClass}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-primary-container/5 to-transparent opacity-50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-primary/10 blur-2xl"
      />
      <div className="z-10 grid h-12 w-12 place-items-center rounded-full bg-surface-container transition-transform group-hover:scale-105">
        {emptyIcon ?? <ScanLine className="h-5 w-5 text-primary" />}
      </div>
      <span className="z-10 text-sm font-semibold text-primary">
        {emptyLabel ?? t('common.addPhoto') ?? 'Añadir foto'}
      </span>
    </button>
  );
}
