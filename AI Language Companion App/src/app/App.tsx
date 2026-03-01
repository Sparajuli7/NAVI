import React, { useState, useEffect } from 'react';
import { NewOnboardingScreen } from './components/NewOnboardingScreen';
import { ConversationScreen } from './components/ConversationScreen';
import { CameraOverlay } from './components/CameraOverlay';
import { AnimatePresence } from 'motion/react';

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

export default function App() {
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [character, setCharacter] = useState<GeneratedCharacter | null>(null);
  const [location, setLocation] = useState('');
  const [isDark, setIsDark] = useState(true);
  const [showCamera, setShowCamera] = useState(false);

  // Set dark mode by default
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const handleOnboardingComplete = (generatedCharacter: GeneratedCharacter, selectedLocation: string) => {
    setCharacter(generatedCharacter);
    setLocation(selectedLocation);
    setHasOnboarded(true);
  };

  const handleToggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className="relative w-full max-w-md mx-auto min-h-screen shadow-2xl">
      {!hasOnboarded ? (
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
