import { create } from 'zustand';
import type { ModelStatus } from '../types/inference';
import type { UserPreferences, } from '../types/character';
import type { LocationContext } from '../types/config';

interface AppStore {
  modelStatus: ModelStatus;
  modelProgress: number;
  userPreferences: UserPreferences;
  currentLocation: LocationContext | null;
  isFirstLaunch: boolean;
  userProfile: string;
  userMode: 'learn' | 'guide' | 'friend' | null;
  geminiApiKey: string;

  setModelStatus: (status: ModelStatus) => void;
  setModelProgress: (progress: number) => void;
  setUserPreferences: (prefs: Partial<UserPreferences>) => void;
  setCurrentLocation: (location: LocationContext) => void;
  setIsFirstLaunch: (value: boolean) => void;
  setUserProfile: (text: string) => void;
  setUserMode: (mode: 'learn' | 'guide' | 'friend' | null) => void;
  setGeminiApiKey: (key: string) => void;
}

const defaultPreferences: UserPreferences = {
  native_language: 'English',
  avatar_age: '30s',
  avatar_gender: 'no_preference',
  avatar_vocation: 'other',
  formality_default: 'neutral',
  learning_focus: ['pronunciation', 'vocabulary'],
};

export const useAppStore = create<AppStore>((set) => ({
  modelStatus: 'not_loaded',
  modelProgress: 0,
  userPreferences: defaultPreferences,
  currentLocation: null,
  isFirstLaunch: true,
  userProfile: '',
  userMode: null,
  geminiApiKey: typeof localStorage !== 'undefined' ? (localStorage.getItem('navi_gemini_key') ?? '') : '',

  setModelStatus: (status) => set({ modelStatus: status }),
  setModelProgress: (progress) => set({ modelProgress: progress }),
  setUserPreferences: (prefs) =>
    set((state) => ({
      userPreferences: { ...state.userPreferences, ...prefs },
    })),
  setCurrentLocation: (location) => set({ currentLocation: location }),
  setIsFirstLaunch: (value) => set({ isFirstLaunch: value }),
  setUserProfile: (text) => set({ userProfile: text }),
  setUserMode: (mode) => set({ userMode: mode }),
  setGeminiApiKey: (key) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('navi_gemini_key', key);
    set({ geminiApiKey: key });
  },
}));
