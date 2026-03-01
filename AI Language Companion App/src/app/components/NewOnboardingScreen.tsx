import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin } from 'lucide-react';
import { BlockyAvatar } from './BlockyAvatar';

const placeholders = [
  "a chill surfer who loves street food...",
  "a nerdy girl who knows hidden gems...",
  "a wise grandma who's secretly wild...",
  "a mysterious cat who speaks 12 languages...",
];

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

interface NewOnboardingScreenProps {
  onComplete: (character: GeneratedCharacter, location: string) => void;
}

export function NewOnboardingScreen({ onComplete }: NewOnboardingScreenProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [promptValue, setPromptValue] = useState('');
  const [location, setLocation] = useState('Ho Chi Minh City');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCharacter, setGeneratedCharacter] = useState<GeneratedCharacter | null>(null);

  // Cycle through placeholders
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const generateCharacter = () => {
    setIsGenerating(true);

    // Simulate character generation based on prompt + location
    setTimeout(() => {
      const names = ['Koji', 'Luna', 'Marco', 'Yuki', 'Sofia', 'Alex'];
      const colorSets = [
        { primary: '#4A5568', secondary: '#F6AD55', accent: '#48BB78' },
        { primary: '#553C9A', secondary: '#ED64A6', accent: '#F6E05E' },
        { primary: '#2C5282', secondary: '#63B3ED', accent: '#FC8181' },
        { primary: '#38A169', secondary: '#68D391', accent: '#F6AD55' },
        { primary: '#D53F8C', secondary: '#FBB6CE', accent: '#9F7AEA' },
        { primary: '#DD6B20', secondary: '#F6AD55', accent: '#48BB78' },
      ];
      
      const accessories = ['🏄‍♂️', '📚', '🎨', '🍜', '🎭', '🗺️'];
      
      const randomIndex = Math.floor(Math.random() * names.length);
      
      const character: GeneratedCharacter = {
        name: names[randomIndex],
        personality: promptValue || placeholders[0],
        colors: colorSets[randomIndex],
        accessory: accessories[randomIndex]
      };

      setGeneratedCharacter(character);

      // Auto-transition to conversation after showing character
      setTimeout(() => {
        onComplete(character, location);
      }, 2500);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Ambient gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-950/20 via-background to-teal-950/20 dark:from-purple-950/10 dark:via-background dark:to-teal-950/10" />

      <AnimatePresence mode="wait">
        {!isGenerating && !generatedCharacter && (
          <motion.div
            key="input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex-1 flex flex-col px-8 py-12"
          >
            {/* Logo/Header */}
            <div className="text-center mb-16">
              <motion.h1
                className="text-3xl mb-3 uppercase tracking-[0.15em] text-primary"
                style={{ fontFamily: 'var(--font-display)' }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                NAVI
              </motion.h1>
              <motion.p
                className="text-foreground/70 text-lg"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                Your local friend, anywhere in the world.
              </motion.p>
            </div>

            {/* Main Prompt Input */}
            <div className="flex-1 flex flex-col justify-center">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <label 
                  className="block mb-4 text-center"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  <span className="text-xl text-foreground">
                    Describe your ideal travel companion
                  </span>
                </label>
                
                <div className="relative mb-3">
                  <textarea
                    value={promptValue}
                    onChange={(e) => setPromptValue(e.target.value)}
                    placeholder={placeholders[placeholderIndex]}
                    className="w-full px-5 py-4 bg-card border-2 border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                    rows={3}
                    style={{ fontSize: '18px', lineHeight: '1.5' }}
                  />
                </div>
                
                <p className="text-sm text-muted-foreground text-center mb-8">
                  Be creative! Your companion's personality comes from this.
                </p>
              </motion.div>

              {/* Location */}
              <motion.div
                className="flex items-center justify-center gap-2 mb-12"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <MapPin className="w-4 h-4 text-secondary" />
                <span className="text-foreground">{location}</span>
                <button className="text-secondary text-sm hover:underline ml-2">
                  Change
                </button>
              </motion.div>
            </div>

            {/* CTA Button */}
            <motion.button
              className="w-full px-12 py-4 bg-primary text-primary-foreground rounded-full font-medium hover:shadow-[0_0_20px_rgba(212,168,83,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={generateCharacter}
              disabled={!promptValue.trim()}
              whileTap={{ scale: 0.97 }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              Meet your companion
            </motion.button>
          </motion.div>
        )}

        {isGenerating && !generatedCharacter && (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex-1 flex flex-col items-center justify-center px-8"
          >
            {/* Pixel assembly animation */}
            <div className="relative w-48 h-48 mb-8">
              {/* Animated particles/pixels */}
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-3 h-3 bg-primary rounded-sm"
                  initial={{
                    x: Math.random() * 200 - 100,
                    y: Math.random() * 200 - 100,
                    opacity: 0,
                    scale: 0
                  }}
                  animate={{
                    x: Math.random() * 40 - 20 + 90,
                    y: Math.random() * 40 - 20 + 90,
                    opacity: [0, 1, 0.5],
                    scale: [0, 1, 0.8]
                  }}
                  transition={{
                    duration: 2,
                    delay: i * 0.05,
                    ease: "easeOut"
                  }}
                />
              ))}
              
              {/* Central glow */}
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.6, 0.3]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <div className="w-24 h-24 bg-primary/20 rounded-full blur-2xl" />
              </motion.div>
            </div>

            <motion.p
              className="text-foreground/70 text-lg"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              Creating your companion...
            </motion.p>
          </motion.div>
        )}

        {generatedCharacter && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 15 }}
              className="mb-8"
            >
              <BlockyAvatar 
                character={generatedCharacter}
                size="xl"
                animate={true}
              />
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h2 
                className="text-2xl mb-3"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Meet {generatedCharacter.name}
              </h2>
              <p className="text-foreground/80 max-w-sm mx-auto">
                {generatedCharacter.personality.charAt(0).toUpperCase() + generatedCharacter.personality.slice(1)}{' '}
                {generatedCharacter.accessory}
              </p>
            </motion.div>

            <motion.div
              className="mt-6 text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              Starting conversation...
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
