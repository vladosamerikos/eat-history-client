import { create } from 'zustand';

export type WeightUnit = 'kg' | 'lb';
export type VolumeUnit = 'ml' | 'floz';
export type HeightUnit = 'cm' | 'ft_in';

export interface UnitPreferences {
  weight: WeightUnit;
  volume: VolumeUnit;
  height: HeightUnit;
}

export const DEFAULT_UNITS: UnitPreferences = {
  weight: 'kg',
  volume: 'ml',
  height: 'cm',
};

export interface PublicUser {
  id: string;
  email?: string;
  name: string;
  locale: string;
  avatarUrl?: string;
  role: string;
  emailVerified: boolean;
  googleConnected?: boolean;
  onboardingCompleted: boolean;
  onboardingStep: string;
  remindersEnabled?: boolean;
  reminderTimes?: { breakfast: string; lunch: string; snack: string; dinner: string };
  reminderTimezone?: string;
  aiModelPreferences?: { vision?: string; text?: string; chat?: string };
  units?: UnitPreferences;
  voicePreferences?: { model?: string; ttsEngine?: 'chirp3' | 'journey' | 'neural2' };
}

interface AuthState {
  user: PublicUser | null;
  setUser: (user: PublicUser | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clear: () => set({ user: null }),
}));
