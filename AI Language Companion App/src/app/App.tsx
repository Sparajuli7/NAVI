import React, { useState, useEffect } from 'react';
import { NewOnboardingScreen } from './components/NewOnboardingScreen';
import { ConversationScreen } from './components/ConversationScreen';
import { CameraOverlay } from './components/CameraOverlay';
import { ModelDownloadScreen } from './components/ModelDownloadScreen';
import { AnimatePresence } from 'motion/react';
import { loadModel, isModelReady, isWebGPUSupported, MODEL_ID } from '../services/modelManager';
import { useAppStore } from '../stores/appStore';
import { useCharacterStore } from '../stores/characterStore';
import { useChatStore } from '../stores/chatStore';
import {
  loadCharacter,
  loadConversation,
  loadMemories,
  loadPreferences,
  loadLocation,
  clearAllData,
} from '../utils/storage';
import type { Character } from '../types/character';

interface GeneratedCharacter {
  name: string;
  personality: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  accessory?: string;
}

function mapCharacterToUI(c: Character): GeneratedCharacter {
  return {
    name: c.name,
    personality: c.summary,
    colors: (c.avatar_color && typeof c.avatar_color === 'object')
      ? c.avatar_color
      : { primary: '#4A5568', secondary: '#F6AD55', accent: '#48BB78' },
    accessory: c.avatar_accessory || undefined,
  };
}

type AppPhase = 'init' | 'no_webgpu' | 'downloading' | 'onboarding' | 'chat';

export default function App() {
  const [appPhase, setAppPhase]         = useState<AppPhase>('init');
  const [progressText, setProgressText] = useState('');
  const [character, setCharacter]       = useState<GeneratedCharacter | null>(null);
  const [location, setLocation]         = useState('');
  const [isDark, setIsDark]             = useState(true);
  const [showCamera, setShowCamera]     = useState(false);

  const { modelStatus, modelProgress } = useAppStore();

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    async function init() {
      // WebGPU support check — must happen before any model work
      if (!isWebGPUSupported()) {
        setAppPhase('no_webgpu');
        return;
      }

      // Restore all persisted data from IndexedDB in parallel
      const [savedChar, savedPrefs, savedMemories, savedMsgs, savedLocation] = await Promise.all([
        loadCharacter(),
        loadPreferences(),
        loadMemories(),
        loadConversation(),
        loadLocation(),
      ]);

      if (savedPrefs) {
        useAppStore.getState().setUserPreferences(savedPrefs);
      }

      // Restore location context (needed for dialect/language on first message)
      if (savedLocation) {
        useAppStore.getState().setCurrentLocation(savedLocation);
      }

      if (savedMemories.length > 0) {
        savedMemories.forEach((m) => useCharacterStore.getState().addMemory(m));
      }

      if (savedChar) {
        useCharacterStore.getState().setActiveCharacter(savedChar);
        if (savedMsgs.length > 0) {
          useChatStore.setState({ messages: savedMsgs });
        }
        setCharacter(mapCharacterToUI(savedChar));
        setLocation(savedLocation
          ? `${savedLocation.city}, ${savedLocation.country}`
          : `${savedChar.location_city}, ${savedChar.location_country}`);
      }

      const targetPhase: AppPhase = savedChar ? 'chat' : 'onboarding';

      if (isModelReady()) {
        setAppPhase(targetPhase);
        return;
      }

      setAppPhase('downloading');
      try {
        await loadModel(MODEL_ID, (_progress, text) => {
          setProgressText(text);
        });
      } catch (err) {
        console.error('Model load failed:', err);
        // modelStatus is already 'error' in the store; user can see in Settings → AI Model
      }
      setAppPhase(targetPhase);
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOnboardingComplete = (generatedCharacter: GeneratedCharacter, selectedLocation: string) => {
    setCharacter(generatedCharacter);
    setLocation(selectedLocation);
    setAppPhase('chat');
  };

  const handleRegenerate = async () => {
    await clearAllData();
    useCharacterStore.getState().setActiveCharacter(null);
    useCharacterStore.getState().clearMemories();
    useChatStore.getState().clearMessages();
    setCharacter(null);
    setLocation('');
    setAppPhase('onboarding');
  };

  const handleToggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  // WebGPU not supported
  if (appPhase === 'no_webgpu') {
    return (
      <div className="relative w-full max-w-md mx-auto min-h-screen shadow-2xl flex flex-col items-center justify-center px-8 bg-background text-center gap-4">
        <p className="text-5xl">😔</p>
        <h2 className="text-xl font-medium text-foreground">WebGPU not supported</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your browser doesn't support on-device AI.{' '}
          Try <strong>Chrome 113+</strong> or <strong>Edge 113+</strong> on desktop.
        </p>
      </div>
    );
  }

  // Loading / downloading model
  if (appPhase === 'init' || appPhase === 'downloading') {
    return (
      <div className="relative w-full max-w-md mx-auto min-h-screen shadow-2xl">
        <ModelDownloadScreen
          progress={modelProgress}
          status={modelStatus}
          progressText={progressText}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-md mx-auto min-h-screen shadow-2xl">
      {appPhase === 'onboarding' ? (
        <NewOnboardingScreen onComplete={handleOnboardingComplete} />
      ) : character ? (
        <>
          <ConversationScreen
            character={character}
            location={location}
            onOpenCamera={() => setShowCamera(true)}
            onToggleTheme={handleToggleTheme}
            onRegenerate={handleRegenerate}
            isDark={isDark}
          />

          <AnimatePresence>
            {showCamera && (
              <CameraOverlay
                character={character}
                onClose={() => setShowCamera(false)}
              />
            )}
          </AnimatePresence>
        </>
      ) : null}
    </div>
  );
}
