import React, { useState, useEffect } from 'react';
import { NewOnboardingScreen } from './components/NewOnboardingScreen';
import { ConversationScreen } from './components/ConversationScreen';
import { CameraOverlay } from './components/CameraOverlay';
import { ModelDownloadScreen } from './components/ModelDownloadScreen';
import { AnimatePresence } from 'motion/react';
import { loadModel, isModelReady, MODEL_ID } from '../services/modelManager';
import { useAppStore } from '../stores/appStore';
import { useCharacterStore } from '../stores/characterStore';
import { useChatStore } from '../stores/chatStore';
import { loadCharacter, loadConversation, loadMemories, loadPreferences } from '../utils/storage';
import type { Character } from '../types/character';

// Simplified shape consumed by existing UI components (BlockyAvatar, ConversationScreen, CameraOverlay)
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

// Maps the rich Character type from the store to the UI's simpler shape
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

type AppPhase = 'init' | 'downloading' | 'onboarding' | 'chat';

export default function App() {
  const [appPhase, setAppPhase]     = useState<AppPhase>('init');
  const [progressText, setProgressText] = useState('');
  const [character, setCharacter]   = useState<GeneratedCharacter | null>(null);
  const [location, setLocation]     = useState('');
  const [isDark, setIsDark]         = useState(true);
  const [showCamera, setShowCamera] = useState(false);

  const { modelStatus, modelProgress } = useAppStore();

  // Set dark mode by default
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // On mount: load saved data, start model if needed
  useEffect(() => {
    async function init() {
      // Load any saved data from IndexedDB
      const [savedChar, savedPrefs, savedMemories, savedMsgs] = await Promise.all([
        loadCharacter(),
        loadPreferences(),
        loadMemories(),
        loadConversation(),
      ]);

      // Restore preferences
      if (savedPrefs) {
        useAppStore.getState().setUserPreferences(savedPrefs);
      }

      // Restore memories
      if (savedMemories.length > 0) {
        savedMemories.forEach((m) => useCharacterStore.getState().addMemory(m));
      }

      // Restore character + messages if they exist
      if (savedChar) {
        useCharacterStore.getState().setActiveCharacter(savedChar);
        if (savedMsgs.length > 0) {
          useChatStore.setState({ messages: savedMsgs });
        }
        setCharacter(mapCharacterToUI(savedChar));
        setLocation(`${savedChar.location_city}, ${savedChar.location_country}`);
      }

      const targetPhase: AppPhase = savedChar ? 'chat' : 'onboarding';

      if (isModelReady()) {
        setAppPhase(targetPhase);
        return;
      }

      // Model not loaded — start download
      setAppPhase('downloading');
      try {
        await loadModel(MODEL_ID, (_progress, text) => {
          setProgressText(text);
        });
        setAppPhase(targetPhase);
      } catch (err) {
        console.error('Model load failed:', err);
        // Still let the user proceed to onboarding; they'll see an error when generating
        setAppPhase(targetPhase);
      }
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOnboardingComplete = (generatedCharacter: GeneratedCharacter, selectedLocation: string) => {
    setCharacter(generatedCharacter);
    setLocation(selectedLocation);
    setAppPhase('chat');
  };

  const handleToggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  // Show download/init screen
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
