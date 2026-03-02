import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin } from 'lucide-react';
import { BlockyAvatar } from './BlockyAvatar';
import { generateCharacter as llmGenerateCharacter } from '../../services/llm';
import { detectLocation } from '../../services/location';
import { isModelReady } from '../../services/modelManager';
import { buildCharacterGenPrompt } from '../../prompts/characterGen';
import { saveCharacter, saveConversation, saveLocation } from '../../utils/storage';
import { useCharacterStore } from '../../stores/characterStore';
import { useChatStore } from '../../stores/chatStore';
import { useAppStore } from '../../stores/appStore';
import type { LocationContext } from '../../types/config';
import type { Message } from '../../types/chat';
import type { Character } from '../../types/character';
import type { DialectInfo } from '../../types/config';
import dialectMap from '../../config/dialectMap.json';

const placeholders = [
  "a chill surfer who loves street food...",
  "a nerdy girl who knows hidden gems...",
  "a wise grandma who's secretly wild...",
  "a mysterious cat who speaks 12 languages...",
];

// Simplified shape consumed by existing UI components
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
  onRetryLoadModel?: () => Promise<void>;
}

const COUNTRY_NAMES: Record<string, string> = {
  JP: 'Japan',
  VN: 'Vietnam',
  FR: 'France',
  MX: 'Mexico',
  KR: 'South Korea',
};

type DialectMapType = Record<string, DialectInfo>;

function getPresetCities(): Array<{ key: string; city: string; country: string }> {
  const map = dialectMap as DialectMapType;
  return Object.keys(map).map((key) => {
    const [countryCode, city] = key.split('/');
    return {
      key,
      city,
      country: COUNTRY_NAMES[countryCode] ?? countryCode,
    };
  });
}

function buildLocationFromPreset(key: string): LocationContext {
  const map = dialectMap as DialectMapType;
  const [countryCode, city] = key.split('/');
  const info = map[key];
  return {
    city,
    country: COUNTRY_NAMES[countryCode] ?? countryCode,
    countryCode,
    lat: 0,
    lng: 0,
    dialectKey: key,
    dialectInfo: info ?? null,
  };
}

// Map the rich Character from LLM to the simpler UI shape
function mapToUI(c: Character): GeneratedCharacter {
  return {
    name: c.name,
    personality: c.summary,
    colors: (c.avatar_color && typeof c.avatar_color === 'object')
      ? c.avatar_color
      : { primary: '#4A5568', secondary: '#F6AD55', accent: '#48BB78' },
    accessory: c.avatar_accessory || undefined,
  };
}

const presetCities = getPresetCities();

export function NewOnboardingScreen({ onComplete, onRetryLoadModel }: NewOnboardingScreenProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [promptValue, setPromptValue]           = useState('');
  const [location, setLocation]                 = useState('Ho Chi Minh City');
  const [locationCtx, setLocationCtx]           = useState<LocationContext | null>(null);
  const [isGenerating, setIsGenerating]         = useState(false);
  const [generatedCharacter, setGeneratedCharacter] = useState<GeneratedCharacter | null>(null);
  const [error, setError]                       = useState<string | null>(null);
  const [showCityPicker, setShowCityPicker]     = useState(false);

  const { setActiveCharacter }  = useCharacterStore();
  const { addMessage }          = useChatStore();
  const { setCurrentLocation }  = useAppStore();
  const { modelStatus }         = useAppStore();

  // Cycle through placeholders
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-detect location on mount
  useEffect(() => {
    detectLocation()
      .then((ctx) => {
        setLocationCtx(ctx);
        setLocation(ctx.city);
      })
      .catch(() => {
        // GPS failed — keep default city, locationCtx stays null
      });
  }, []);

  const generateCharacter = async () => {
    if (!promptValue.trim()) return;
    if (!isModelReady()) {
      setError(
        modelStatus === 'error'
          ? 'Model failed to load. Tap Retry below to try again.'
          : 'Model is still loading. Wait for the download to finish, then try again.'
      );
      return;
    }
    setIsGenerating(true);
    setError(null);

    try {
      const prompt = buildCharacterGenPrompt(promptValue, locationCtx);
      const richCharacter = await llmGenerateCharacter(prompt);

      // Ensure we have a stable id
      if (!richCharacter.id || richCharacter.id.startsWith('<')) {
        richCharacter.id = `char_${Date.now()}`;
      }

      // Save to stores
      setActiveCharacter(richCharacter);
      if (locationCtx) {
        setCurrentLocation(locationCtx);
        await saveLocation(locationCtx);
      }

      // Add the character's first message to chat
      if (richCharacter.first_message) {
        const firstMsg: Message = {
          id: Date.now().toString(),
          role: 'character',
          content: richCharacter.first_message,
          type: 'text',
          timestamp: Date.now(),
          showAvatar: true,
        };
        addMessage(firstMsg);
        await saveConversation([firstMsg]);
      }

      // Persist character to IndexedDB
      await saveCharacter(richCharacter);

      // Map to the simpler UI shape for display + transition
      const uiChar = mapToUI(richCharacter);
      setGeneratedCharacter(uiChar);

      // Reveal animation plays for 2.5 s then transition
      setTimeout(() => {
        onComplete(uiChar, locationCtx?.city ?? location);
      }, 2500);
    } catch (err) {
      console.error('Character generation failed:', err);
      setIsGenerating(false);
      setError('Generation failed — make sure the model is loaded and try again.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-57px)] bg-background flex flex-col relative overflow-hidden">
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
            {/* Tagline */}
            <div className="text-center mb-16">
              <motion.p
                className="text-foreground/70 text-lg"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
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

                {/* Error message — only shown on failure */}
                {error && (
                  <p className="text-sm text-destructive text-center mb-4">{error}</p>
                )}
                {/* Model failed — show Retry */}
                {modelStatus === 'error' && onRetryLoadModel && (
                  <div className="flex justify-center mb-4">
                    <button
                      type="button"
                      onClick={() => { setError(null); onRetryLoadModel(); }}
                      className="text-sm text-secondary hover:underline"
                    >
                      Retry loading model
                    </button>
                  </div>
                )}
              </motion.div>

              {/* Location */}
              <motion.div
                className="flex flex-col items-center gap-2 mb-12"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div className="flex items-center justify-center gap-2">
                  <MapPin className="w-4 h-4 text-secondary" />
                  <span className="text-foreground">{location}</span>
                  <button
                    type="button"
                    onClick={() => setShowCityPicker((prev) => !prev)}
                    className="text-secondary text-sm hover:underline ml-2"
                  >
                    Change
                  </button>
                </div>
                {showCityPicker && (
                  <div className="flex flex-wrap justify-center gap-2 mt-2 max-w-xs">
                    {presetCities.map(({ key, city, country }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setLocation(city);
                          setLocationCtx(buildLocationFromPreset(key));
                          setShowCityPicker(false);
                        }}
                        className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-foreground hover:border-primary/30 transition-colors"
                      >
                        {city}, {country}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setShowCityPicker(false);
                        detectLocation()
                          .then((ctx) => {
                            setLocationCtx(ctx);
                            setLocation(ctx.city);
                          })
                          .catch(() => {});
                      }}
                      className="px-3 py-1.5 text-sm bg-primary/20 border border-primary/40 rounded-lg text-primary hover:bg-primary/30 transition-colors"
                    >
                      Detect my location
                    </button>
                  </div>
                )}
              </motion.div>
            </div>

            {/* CTA Button */}
            <motion.button
              className="w-full px-12 py-4 bg-primary text-primary-foreground rounded-full font-medium hover:shadow-[0_0_20px_rgba(212,168,83,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={generateCharacter}
              disabled={!promptValue.trim() || modelStatus !== 'ready'}
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
