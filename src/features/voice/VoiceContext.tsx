import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface VoiceOpenOptions {
  /** Callback que dispara invalidaciones al cerrar / cambiar datos. */
  onChanged?: () => void;
  /** URL de foto a pasar al agente (iteración 2). */
  photoUrl?: string;
  /**
   * Qué agente atiende la sesión:
   * - 'meal' (por defecto): registro rápido de comidas (agentName=foodcommit).
   * - 'chat': coach conversacional configurable (agentName=foodcommit-chat).
   */
  agent?: 'meal' | 'chat';
}

interface VoiceContextValue {
  isOpen: boolean;
  isMinimized: boolean;
  options: VoiceOpenOptions;
  open: (opts?: VoiceOpenOptions) => void;
  minimize: () => void;
  restore: () => void;
  close: () => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [options, setOptions] = useState<VoiceOpenOptions>({});

  const open = useCallback((opts?: VoiceOpenOptions) => {
    setOptions(opts ?? {});
    setIsMinimized(false);
    setIsOpen(true);
  }, []);

  const minimize = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const restore = useCallback(() => {
    setIsMinimized(false);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
    setOptions({});
  }, []);

  const value = useMemo<VoiceContextValue>(
    () => ({ isOpen, isMinimized, options, open, minimize, restore, close }),
    [isOpen, isMinimized, options, open, minimize, restore, close],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used within <VoiceProvider>');
  return ctx;
}
