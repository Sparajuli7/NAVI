import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin } from 'lucide-react';
import { CharacterAvatar } from './CharacterAvatar';
import { AvatarBuilder } from './AvatarBuilder';
import { loadAvatarPrefs, saveAvatarPrefs, deriveAvatarPrefs, validateAvatarPrefs } from '../../utils/avatarPrefs';
import type { AvatarPrefs } from '../../utils/avatarPrefs';
import { detectLocation } from '../../services/location';
import { buildCharacterGenPrompt } from '../../prompts/characterGen';
import { saveCharacter, saveConversation, saveLocation, saveAvatarImage } from '../../utils/storage';
import { generateAvatarImage, generateAvatarImageFromDescription } from '../../utils/generateAvatarImage';
import { useNaviAgent } from '../../agent/react/useNaviAgent';
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
  NP: 'Nepal',
};

const NATIVE_LANGUAGES = [
  'English', 'Spanish', 'Portuguese', 'French', 'Hindi',
  'Nepali', 'Mandarin', 'Arabic', 'Korean', 'Japanese',
  'German', 'Italian', 'Other',
];

// Target languages with associated country codes for city filtering
const TARGET_LANGUAGES: Array<{ name: string; countryCodes: string[] }> = [
  { name: 'Nepali', countryCodes: ['NP'] },
  { name: 'Japanese', countryCodes: ['JP'] },
  { name: 'French', countryCodes: ['FR'] },
  { name: 'Spanish', countryCodes: ['MX'] },
  { name: 'Vietnamese', countryCodes: ['VN'] },
  { name: 'Korean', countryCodes: ['KR'] },
  { name: 'Mandarin', countryCodes: ['TW', 'CN', 'SG'] },
  { name: 'Other / Unlisted', countryCodes: [] },
];

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

// Clarification chip sets for sparse input
const VIBE_CHIPS = [
  { label: 'Chill 😎', text: 'chill and easygoing' },
  { label: 'Funny 😂', text: 'funny and sarcastic' },
  { label: 'Warm 🤗', text: 'warm and encouraging' },
  { label: 'Bold 🔥', text: 'bold and direct' },
  { label: 'Mysterious 🌙', text: 'mysterious and deep' },
];
const EXPERTISE_CHIPS = [
  { label: 'Street food 🍜', text: 'knows the best street food spots' },
  { label: 'Nightlife 🌃', text: 'expert in nightlife and bars' },
  { label: 'Hidden gems 💎', text: 'finds hidden local gems' },
  { label: 'Culture 🎭', text: 'loves art and local culture' },
  { label: 'Navigation 🗺', text: 'great at directions and transport' },
];

export function NewOnboardingScreen({ onComplete, onRetryLoadModel }: NewOnboardingScreenProps) {
  const [onboardingStep, setOnboardingStep]     = useState<'target' | 'language' | 'describe' | 'appearance'>('target');
  const [targetLanguage, setTargetLanguage]     = useState('');
  const [filteredCities, setFilteredCities]     = useState(presetCities);
  const [nativeLanguage, setNativeLanguage]     = useState('English');
  const [otherLanguageInput, setOtherLanguageInput] = useState('');
  const [showOtherInput, setShowOtherInput]     = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [promptValue, setPromptValue]           = useState('');
  const [nameInput, setNameInput]               = useState('');
  const [location, setLocation]                 = useState('Ho Chi Minh City');
  const [locationCtx, setLocationCtx]           = useState<LocationContext | null>(null);
  const [isGenerating, setIsGenerating]         = useState(false);
  const [generatedCharacter, setGeneratedCharacter] = useState<GeneratedCharacter | null>(null);
  const [error, setError]                       = useState<string | null>(null);
  const [showCityPicker, setShowCityPicker]     = useState(false);
  const [showClarify, setShowClarify]           = useState(false);
  const [selectedVibes, setSelectedVibes]       = useState<string[]>([]);
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);
  const [avatarPrefs, setAvatarPrefs]           = useState<AvatarPrefs>(() => loadAvatarPrefs());
  const [showAvatarBuilder, setShowAvatarBuilder] = useState(true);
  const [appearanceText, setAppearanceText]           = useState('');
  const [pendingAvatarUrl, setPendingAvatarUrl]       = useState('');
  const [isGeneratingAvatar, setIsGeneratingAvatar]   = useState(false);

  const { setActiveCharacter }  = useCharacterStore();
  const { addMessage }          = useChatStore();
  const { setCurrentLocation }  = useAppStore();
  const { modelStatus }         = useAppStore();
  const { agent, isLLMReady }   = useNaviAgent();

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

  // Extract the first JSON object from an LLM response, stripping markdown fences and preamble
  const extractJSON = (raw: string): string => {
    const stripped = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const match = stripped.match(/\{[\s\S]*\}/);
    return match ? match[0] : stripped;
  };

  // Build the enriched description from base input + selected chips
  const buildEnrichedDescription = (): string => {
    const parts = [promptValue.trim()];
    if (selectedVibes.length > 0) parts.push(selectedVibes.join(', '));
    if (selectedExpertise.length > 0) parts.push(selectedExpertise.join(', '));
    return parts.filter(Boolean).join('; ');
  };

  const handleGenerateClick = () => {
    const desc = promptValue.trim();
    if (!desc) return;
    // If description is sparse and clarify panel not shown yet → show it first
    if (desc.length < 25 && !showClarify) {
      setShowClarify(true);
      return;
    }
    setOnboardingStep('appearance');
  };

  const toggleVibe = (text: string) => {
    setSelectedVibes(prev =>
      prev.includes(text) ? prev.filter(v => v !== text) : [...prev, text]
    );
  };

  const toggleExpertise = (text: string) => {
    setSelectedExpertise(prev =>
      prev.includes(text) ? prev.filter(e => e !== text) : [...prev, text]
    );
  };

  const generateCharacter = async () => {
    const enriched = buildEnrichedDescription();
    if (!enriched) return;
    if (!isLLMReady) {
      setError(
        modelStatus === 'error'
          ? 'Model failed to load. Tap Retry below to try again.'
          : 'Model is still loading. Wait for the download to finish, then try again.'
      );
      return;
    }
    setIsGenerating(true);
    setError(null);
    setShowClarify(false);

    try {
      const prompt = buildCharacterGenPrompt(enriched, locationCtx, nameInput.trim() || undefined);

      // Use agent's LLM for character generation
      const llm = agent.getLLM();
      const sysMsg  = { role: 'system', content: 'You are a character generator. Respond ONLY with valid JSON, no markdown fences.' };
      const userMsg = { role: 'user', content: prompt };

      const city    = locationCtx?.city ?? location;
      const country = locationCtx?.country ?? '';

      // Culturally appropriate fallback names per city
      const fallbackNameFor = (c: string): string => {
        const n = c.toLowerCase();
        if (n.includes('seoul'))           return nameInput.trim() || '지훈';
        if (n.includes('tokyo'))           return nameInput.trim() || 'Aiko';
        if (n.includes('osaka'))           return nameInput.trim() || 'Nana';
        if (n.includes('ho chi minh') || n.includes('saigon')) return nameInput.trim() || 'Linh';
        if (n.includes('paris'))           return nameInput.trim() || 'Léa';
        if (n.includes('mexico'))          return nameInput.trim() || 'Diego';
        if (n.includes('kathmandu')) { const kn = ['Arjun','Sita','Arun','Priya','Ramesh','Anisha','Santosh','Deepa','Rohan','Maya']; return nameInput.trim() || kn[Math.floor(Math.random() * kn.length)]; }
        return nameInput.trim() || 'Kai';
      };

      // Helper: fill in any missing fields so the Character is always complete
      const fillDefaults = (partial: Partial<Character>): Character => {
        const safeName = (partial.name && !partial.name.startsWith('(') && !partial.name.startsWith('<'))
          ? partial.name
          : fallbackNameFor(city);
        return {
          id:               `char_${Date.now()}`,
          name:             safeName,
          summary:          (partial.summary && !partial.summary.startsWith('('))
                              ? partial.summary
                              : `${safeName} — your local guide in ${city}`,
          detailed:         partial.detailed         ?? '',
          style:            partial.style            ?? 'casual',
          emoji:            partial.emoji            ?? '🌟',
          avatar_color:     partial.avatar_color     ?? { primary: '#6B7280', secondary: '#F6AD55', accent: '#48BB78' },
          avatar_accessory: partial.avatar_accessory ?? '🎒',
          speaks_like:      partial.speaks_like      ?? 'warm and conversational',
          template_id:      partial.template_id      ?? null,
          location_city:    partial.location_city    ?? city,
          location_country: partial.location_country ?? country,
          first_message:    (partial.first_message && !partial.first_message.startsWith('('))
                              ? partial.first_message
                              : `Hey! I'm ${safeName}, your local friend in ${city}. What do you want to explore?`,
          portrait_prompt:  (partial.portrait_prompt && !partial.portrait_prompt.startsWith('('))
                              ? partial.portrait_prompt
                              : undefined,
        };
      };

      let richCharacter: Character;
      let resolvedPrefs: AvatarPrefs = { ...loadAvatarPrefs() };

      // Attempt 1 — full JSON, creative temperature
      try {
        const raw = await llm.chat([sysMsg, userMsg], { temperature: 0.8, max_tokens: 700 });
        console.log('[NAVI] chargen attempt 1:', raw);
        const parsed1 = JSON.parse(extractJSON(raw)) as Partial<Character> & { avatar_prefs?: unknown };
        richCharacter = fillDefaults(parsed1);
        resolvedPrefs = validateAvatarPrefs(parsed1.avatar_prefs)
          ?? deriveAvatarPrefs(
               { style: richCharacter.style, summary: richCharacter.summary },
               useAppStore.getState().userPreferences,
             );
      } catch {
        // Attempt 2 — full JSON, lower temperature
        try {
          const raw2 = await llm.chat([sysMsg, userMsg], { temperature: 0.3, max_tokens: 700 });
          console.log('[NAVI] chargen attempt 2:', raw2);
          const parsed2 = JSON.parse(extractJSON(raw2)) as Partial<Character> & { avatar_prefs?: unknown };
          richCharacter = fillDefaults(parsed2);
          resolvedPrefs = validateAvatarPrefs(parsed2.avatar_prefs)
            ?? deriveAvatarPrefs(
                 { style: richCharacter.style, summary: richCharacter.summary },
                 useAppStore.getState().userPreferences,
               );
        } catch {
          // Attempt 3 — minimal 3-field prompt, much smaller output
          try {
            const fallName = fallbackNameFor(city);
            const minimalPrompt = `Create a local friend named ${fallName} in ${city}${country ? `, ${country}` : ''}. Description: "${enriched}". Output ONLY this JSON:\n{"name":"${fallName}","summary":"${fallName} — one sentence about them","first_message":"one sentence greeting in the local language of ${city} with pronunciation"}`;
            const raw3 = await llm.chat(
              [{ role: 'system', content: 'Output ONLY valid JSON. No markdown.' }, { role: 'user', content: minimalPrompt }],
              { temperature: 0.2, max_tokens: 200 },
            );
            console.log('[NAVI] chargen attempt 3 (minimal):', raw3);
            const parsed3 = JSON.parse(extractJSON(raw3)) as Partial<Character> & { avatar_prefs?: unknown };
            richCharacter = fillDefaults(parsed3);
            resolvedPrefs = validateAvatarPrefs(parsed3.avatar_prefs)
              ?? deriveAvatarPrefs(
                   { style: richCharacter.style, summary: richCharacter.summary },
                   useAppStore.getState().userPreferences,
                 );
          } catch {
            // Final fallback — synthetic character, no LLM needed
            console.warn('[NAVI] All LLM attempts failed — using synthetic character');
            const fallbackName = fallbackNameFor(city);
            richCharacter = fillDefaults({
              name:          fallbackName,
              summary:       `${fallbackName} — your local guide in ${city}`,
              first_message: `Hey! I'm ${fallbackName}, your local friend in ${city}. I know this place well — what do you want to do or find?`,
            });
            resolvedPrefs = deriveAvatarPrefs(
              { style: richCharacter.style, summary: richCharacter.summary },
              useAppStore.getState().userPreferences,
            );
          }
        }
      }

      // Ensure we have a stable id
      if (!richCharacter.id || richCharacter.id.startsWith('<')) {
        richCharacter.id = `char_${Date.now()}`;
      }

      // Persist avatar prefs: save to localStorage + seed the AvatarBuilder
      richCharacter.avatar_prefs = resolvedPrefs;
      saveAvatarPrefs(resolvedPrefs);
      setAvatarPrefs(resolvedPrefs);

      // Persist dialect key and target language so avatar language works on reload
      richCharacter.dialect_key = locationCtx?.dialectKey ?? '';
      richCharacter.target_language = targetLanguage || undefined;
      richCharacter.avatarImageUrl = pendingAvatarUrl || undefined;

      // Save to stores
      setActiveCharacter(richCharacter);
      if (locationCtx) {
        setCurrentLocation(locationCtx);
        await saveLocation(locationCtx);
      }

      // Set up agent avatar so the agent context is ready for chat
      // Map LLM-generated character fields into a full AvatarProfile
      const loc = locationCtx?.city ?? location;
      const dialectKey = locationCtx?.dialectKey ?? '';
      const dialectInfo = locationCtx?.dialectInfo;

      const avatarProfile = agent.avatar.createFromDescription(
        richCharacter.detailed || richCharacter.summary,
        {
          name: richCharacter.name,
          personality: richCharacter.detailed || richCharacter.summary,
          speaksLike: richCharacter.speaks_like || 'a friendly local',
          energyLevel: (['energetic', 'playful'].includes(richCharacter.style) ? 'high'
            : ['mysterious', 'dry-humor'].includes(richCharacter.style) ? 'low'
            : 'medium') as 'low' | 'medium' | 'high',
          humorStyle: (['playful', 'dry-humor'].includes(richCharacter.style) ? richCharacter.style
            : 'warm') as string,
          slangLevel: (['casual', 'streetwise', 'energetic', 'playful'].includes(richCharacter.style) ? 0.7 : 0.4),
          dialect: dialectKey || dialectInfo?.dialect || '',
          culturalContext: dialectInfo?.cultural_notes ?? '',
          location: loc,
          scenario: '',
          visual: {
            primaryColor: richCharacter.avatar_color?.primary ?? '#6BBAA7',
            secondaryColor: richCharacter.avatar_color?.secondary ?? '#D4A853',
            accentColor: richCharacter.avatar_color?.accent ?? '#F5F0EB',
            accessory: richCharacter.avatar_accessory ?? richCharacter.emoji ?? '🌍',
            emoji: richCharacter.emoji ?? '🌍',
          },
        },
        loc,
      );
      agent.setAvatar(avatarProfile);

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

      // Fire AI portrait generation non-blocking — UI proceeds immediately.
      // On success: portrait is saved to IndexedDB and AIAvatarDisplay auto-loads it.
      // On failure: DiceBear fallback remains the experience (no error shown).
      if (richCharacter.portrait_prompt) {
        const charIdForPortrait = richCharacter.id;
        const portraitPrompt = richCharacter.portrait_prompt;
        // Attempt 1 immediately
        generateAvatarImage(portraitPrompt, charIdForPortrait)
          .then(async (base64) => {
            if (base64) {
              await saveAvatarImage(charIdForPortrait, base64);
              richCharacter.has_portrait = true;
              await saveCharacter(richCharacter);
            } else {
              // Attempt 2 after 5s
              setTimeout(() => {
                generateAvatarImage(portraitPrompt, charIdForPortrait)
                  .then(async (b2) => {
                    if (b2) {
                      await saveAvatarImage(charIdForPortrait, b2);
                      richCharacter.has_portrait = true;
                      await saveCharacter(richCharacter);
                    } else {
                      // Attempt 3 after 15s
                      setTimeout(() => {
                        generateAvatarImage(portraitPrompt, charIdForPortrait)
                          .then(async (b3) => {
                            if (b3) {
                              await saveAvatarImage(charIdForPortrait, b3);
                              richCharacter.has_portrait = true;
                              await saveCharacter(richCharacter);
                            }
                          })
                          .catch(() => {/* DiceBear remains */});
                      }, 15_000);
                    }
                  })
                  .catch(() => {/* DiceBear remains */});
              }, 5_000);
            }
          })
          .catch(() => {/* DiceBear remains */});
      }

      // Save native language to agent memory + appStore
      const finalNativeLang = showOtherInput ? (otherLanguageInput.trim() || 'English') : nativeLanguage;
      await agent.memory.profile.setNativeLanguage(finalNativeLang);
      useAppStore.getState().setUserPreferences({ native_language: finalNativeLang });

      // Save target language to agent memory + appStore
      if (targetLanguage) {
        await agent.memory.profile.setTargetLanguage(targetLanguage);
        useAppStore.getState().setUserPreferences({ target_language: targetLanguage });
      }

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
      setError("Couldn't create your companion. Try tweaking your description and tap again.");
    }
  };

  return (
    <div className="min-h-[calc(100vh-57px)] bg-background flex flex-col relative overflow-hidden">
      {/* Ambient gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-950/20 via-background to-teal-950/20 dark:from-purple-950/10 dark:via-background dark:to-teal-950/10" />

      <AnimatePresence mode="wait">
        {/* Step 0: Target language picker */}
        {onboardingStep === 'target' && !isGenerating && !generatedCharacter && (
          <motion.div
            key="target"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex-1 flex flex-col px-8 py-12"
          >
            <div className="text-center mb-8">
              <motion.h2
                className="text-2xl mb-2"
                style={{ fontFamily: 'var(--font-display)' }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                What language do you want to learn?
              </motion.h2>
              <motion.p
                className="text-foreground/60 text-sm"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Your companion will speak this language and help you learn it naturally.
              </motion.p>
            </div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex-1"
            >
              <div className="grid grid-cols-2 gap-2">
                {TARGET_LANGUAGES.map((lang) => (
                  <button
                    key={lang.name}
                    type="button"
                    onClick={() => {
                      setTargetLanguage(lang.name);
                      // Filter city presets to those matching this language's countries
                      if (lang.countryCodes.length > 0) {
                        setFilteredCities(
                          presetCities.filter((c) => lang.countryCodes.includes(c.key.split('/')[0])),
                        );
                      } else {
                        setFilteredCities(presetCities); // "Other" — show all
                      }
                      setOnboardingStep('language');
                    }}
                    className={`px-3 py-4 rounded-xl border text-sm font-medium transition-all text-left ${
                      targetLanguage === lang.name
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border text-foreground hover:border-primary/40'
                    }`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Step 2: Native language picker */}
        {onboardingStep === 'language' && !isGenerating && !generatedCharacter && (
          <motion.div
            key="language"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex-1 flex flex-col px-8 py-12"
          >
            <div className="text-center mb-8">
              <motion.h2
                className="text-2xl mb-2"
                style={{ fontFamily: 'var(--font-display)' }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                What language do you speak?
              </motion.h2>
              <motion.p
                className="text-foreground/60 text-sm"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                This is your base. I'll use it when you need a translation or I need to explain something.
              </motion.p>
            </div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex-1"
            >
              <div className="grid grid-cols-3 gap-2">
                {NATIVE_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      if (lang === 'Other') {
                        setShowOtherInput(true);
                        setNativeLanguage('Other');
                      } else {
                        setNativeLanguage(lang);
                        setShowOtherInput(false);
                        setOnboardingStep('describe');
                      }
                    }}
                    className={`px-3 py-3 rounded-xl border text-sm font-medium transition-all ${
                      nativeLanguage === lang
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border text-foreground hover:border-primary/40'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>

              {showOtherInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4"
                >
                  <input
                    type="text"
                    value={otherLanguageInput}
                    onChange={(e) => setOtherLanguageInput(e.target.value)}
                    placeholder="Type your language..."
                    autoFocus
                    className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && otherLanguageInput.trim()) {
                        setOnboardingStep('describe');
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={!otherLanguageInput.trim()}
                    onClick={() => setOnboardingStep('describe')}
                    className="w-full mt-3 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium disabled:opacity-40"
                  >
                    Continue →
                  </button>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}

        {!isGenerating && !generatedCharacter && onboardingStep === 'describe' && (
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

                <p className="text-sm text-muted-foreground text-center mb-4">
                  Be creative! Your companion's personality comes from this.
                </p>

                {/* Optional: give them a name */}
                <div className="mb-4">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Give them a name (optional)"
                    className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 text-sm"
                  />
                </div>

                {/* Clarification chips — shown when description is short */}
                <AnimatePresence>
                  {showClarify && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mb-4"
                    >
                      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                        <p className="text-xs font-medium text-muted-foreground">Add more personality (optional):</p>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1.5">Vibe</p>
                          <div className="flex flex-wrap gap-1.5">
                            {VIBE_CHIPS.map(chip => (
                              <button
                                key={chip.text}
                                type="button"
                                onClick={() => toggleVibe(chip.text)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                  selectedVibes.includes(chip.text)
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background text-foreground border-border hover:border-primary/40'
                                }`}
                              >
                                {chip.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1.5">Good at</p>
                          <div className="flex flex-wrap gap-1.5">
                            {EXPERTISE_CHIPS.map(chip => (
                              <button
                                key={chip.text}
                                type="button"
                                onClick={() => toggleExpertise(chip.text)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                  selectedExpertise.includes(chip.text)
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background text-foreground border-border hover:border-primary/40'
                                }`}
                              >
                                {chip.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

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
                    {filteredCities.map(({ key, city, country }) => (
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
              onClick={handleGenerateClick}
              disabled={!promptValue.trim() || !isLLMReady}
              whileTap={{ scale: 0.97 }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {showClarify ? 'Create companion →' : 'Meet your companion'}
            </motion.button>
          </motion.div>
        )}

        {/* Step: Appearance — collect visual description, generate HF avatar */}
        {onboardingStep === 'appearance' && !isGenerating && !generatedCharacter && (
          <motion.div
            key="appearance"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="relative z-10 flex-1 flex flex-col px-6 pt-8 pb-6"
          >
            <h2 className="text-2xl font-display font-semibold text-foreground mb-1">
              What does {nameInput || 'your companion'} look like?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Describe their appearance — style, vibe, whatever you imagine.
            </p>
            <textarea
              className="w-full rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              rows={4}
              placeholder="e.g. warm smile, round glasses, cozy sweater..."
              value={appearanceText}
              onChange={(e) => setAppearanceText(e.target.value)}
            />
            <div className="flex gap-3 mt-6">
              <button
                className="flex-1 px-6 py-3 rounded-full border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                onClick={() => { setPendingAvatarUrl(''); generateCharacter(); }}
              >
                Skip
              </button>
              <button
                className="flex-1 px-6 py-3 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:shadow-[0_0_20px_rgba(212,168,83,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!appearanceText.trim() || isGeneratingAvatar}
                onClick={async () => {
                  setIsGeneratingAvatar(true);
                  const url = await generateAvatarImageFromDescription(appearanceText);
                  setPendingAvatarUrl(url);
                  setIsGeneratingAvatar(false);
                  generateCharacter();
                }}
              >
                {isGeneratingAvatar ? 'Creating avatar…' : 'Generate Avatar'}
              </button>
            </div>
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
            className="relative z-10 flex-1 flex flex-col items-center justify-start px-8 py-8 overflow-y-auto"
          >
            {/* Avatar preview */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 15 }}
              className="mb-4 flex items-center justify-center"
              style={{ width: 160, height: 160 }}
            >
              <CharacterAvatar
                character={{
                  colors: generatedCharacter.colors,
                  location_country: locationCtx?.countryCode,
                }}
                size="xl"
                animationState="success"
              />
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center mb-6"
            >
              <h2
                className="text-2xl mb-2"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Meet {generatedCharacter.name}
              </h2>
              <p className="text-foreground/80 max-w-sm mx-auto text-sm">
                {generatedCharacter.personality.charAt(0).toUpperCase() + generatedCharacter.personality.slice(1)}{' '}
                {generatedCharacter.accessory}
              </p>
            </motion.div>

            {/* Avatar builder — expand/collapse */}
            <motion.div
              className="w-full max-w-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <button
                onClick={() => setShowAvatarBuilder((prev: boolean) => !prev)}
                className="w-full flex items-center justify-between px-4 py-2.5 mb-3 bg-card border border-border rounded-xl text-sm text-foreground hover:border-primary/40 transition-colors"
              >
                <span>✏️ Customize your look</span>
                <span className="text-muted-foreground">{showAvatarBuilder ? '▲' : '▼'}</span>
              </button>

              <AnimatePresence>
                {showAvatarBuilder && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-card border border-border rounded-xl p-4 mb-4">
                      <AvatarBuilder
                        prefs={avatarPrefs}
                        onChange={(next) => {
                          setAvatarPrefs(next);
                          saveAvatarPrefs(next);
                        }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div
              className="text-sm text-muted-foreground mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              Starting conversation...
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
