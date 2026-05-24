import { useRef } from 'react';
import { Camera, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionSheet } from './ActionSheet';

interface Props {
  open: boolean;
  onClose: () => void;
  onFile: (file: File) => void;
  title?: string;
  accept?: string;
}

/**
 * ActionSheet reutilizable que ofrece "Tomar foto" / "Subir desde galería"
 * y dispara los `<input type="file">` ocultos con o sin `capture="environment"`.
 *
 * Mantiene los dos inputs en el mismo componente para evitar duplicar lógica
 * en cada pantalla (AddMealModal, FoodsPage, VoiceDrawer…).
 */
export function PhotoSourceSheet({ open, onClose, onFile, title, accept = 'image/*' }: Props) {
  const { t } = useTranslation();
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    onClose();
    if (f) onFile(f);
  };

  return (
    <>
      <ActionSheet
        open={open}
        onClose={onClose}
        title={title ?? (t('meals.photo.takeOrUpload') ?? 'Añadir foto')}
        items={[
          {
            key: 'camera',
            label: t('meals.photo.takePhoto') ?? 'Tomar foto',
            icon: Camera,
            onSelect: () => cameraRef.current?.click(),
          },
          {
            key: 'gallery',
            label: t('meals.photo.uploadFromGallery') ?? 'Subir desde galería',
            icon: Upload,
            onSelect: () => galleryRef.current?.click(),
          },
        ]}
      />
      <input
        ref={cameraRef}
        type="file"
        accept={accept}
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
    </>
  );
}
