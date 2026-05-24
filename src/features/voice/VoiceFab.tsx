import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic } from 'lucide-react';
import { useVoice } from './VoiceContext';

/**
 * FAB flotante que aparece cuando el VoiceDrawer está minimizado.
 * Se posiciona por encima del bottom-nav (4.5rem reserved en AppLayout).
 */
export function VoiceFab() {
  const { t } = useTranslation();
  const { isOpen, isMinimized, restore } = useVoice();
  const show = isOpen && isMinimized;

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          key="voice-fab"
          type="button"
          onClick={restore}
          initial={{ opacity: 0, scale: 0.8, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 16 }}
          transition={{ type: 'spring', stiffness: 360, damping: 24 }}
          aria-label={t('voice.restore') ?? t('voice.openAria') ?? 'Abrir asistente'}
          className="fixed right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-2xl ring-2 ring-primary/40"
          style={{
            bottom: 'calc(4.75rem + env(safe-area-inset-bottom))',
          }}
        >
          <motion.span
            className="absolute inset-0 rounded-full bg-primary/40"
            animate={{ scale: [1, 1.45, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
          <Mic className="relative h-6 w-6" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
