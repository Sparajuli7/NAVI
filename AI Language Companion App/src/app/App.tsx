import React, { useState, useEffect } from 'react';
import { AvatarSelectScreen } from './components/AvatarSelectScreen';
import { ConversationScreen } from './components/ConversationScreen';
import { CameraOverlay } from './components/CameraOverlay';
import { ModelDownloadScreen } from './components/ModelDownloadScreen';
import { BackendSelectScreen } from './components/BackendSelectScreen';
import { HomeScreen } from './components/HomeScreen';
import { ScenarioLauncher, buildContextSummary } from './components/ScenarioLauncher';
import { Navbar } from './components/Navbar';
import { SettingsPanel } from './components/SettingsPanel';
import { AnimatePresence } from 'motion/react';
import type { ScenarioKey, ParsedScenarioContext, LocationContext, DialectInfo } from '../types/config';
import type { AvatarTemplate } from '../types/character';
import type { Message } from '../types/chat';
import { isWebGPUSupported } from '../services/modelManager';
import { useNaviAgent } from '../agent/react/useNaviAgent';
import { useAppStore } from '../stores/appStore';
import { useCharacterStore } from '../stores/characterStore';
import { useChatStore } from '../stores/chatStore';
import {
  loadCharacter,
  loadConversation,
  loadMemories,
  loadPreferences,
  loadLocation,
  loadCharacters,
  loadCharacterConversation,
  loadCharacterMemories,
  loadUserProfile,
  saveCharacters,
  saveCharacter,
  saveCharacterConversation,
  saveLocation,
  saveUserProfile,
  deleteCharacterData,
} from '../utils/storage';
import type { Character } from '../types/character';
import dialectMapRaw from '../config/dialectMap.json';

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

type AppPhase = 'init' | 'no_webgpu' | 'backend_select' | 'downloading' | 'home' | 'onboarding' | 'chat';

export default function App() {
  const [appPhase, setAppPhase]             = useState<AppPhase>('init');
  const [character, setCharacter]           = useState<GeneratedCharacter | null>(null);
  const [location, setLocation]             = useState('');
  const [isDark, setIsDark]                 = useState(true);
  const [showCamera, setShowCamera]         = useState(false);
  const [showScenarioLauncher, setShowScenarioLauncher] = useState(false);
  const [showHomeSettings, setShowHomeSettings] = useState(false);
  // Full list of companions (Character objects for HomeScreen)
  const [companions, setCompanions]         = useState<Character[]>([]);

  const { modelStatus, modelProgress } = useAppStore();

  // Agent framework — singleton, handles LLM loading + memory + director + tools
  const { agent, initialize: initAgent, loadLLM, loadStatusText } = useNaviAgent();

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    async function init() {
      // Initialize agent (loads memory, detects Ollama, sets backend)
      try {
        await initAgent();
      } catch (err) {
        console.error('Agent initialization error:', err);
      }

      const activeBackend = agent.getBackend();

      // If WebLLM backend selected but no WebGPU, show error
      if (activeBackend === 'webllm' && !isWebGPUSupported()) {
        setAppPhase('no_webgpu');
        return;
      }

      // Restore all persisted data in parallel
      const [savedChars, savedChar, savedPrefs, savedMemories, savedMsgs, savedLocation, savedProfile] =
        await Promise.all([
          loadCharacters(),
          loadCharacter(),
          loadPreferences(),
          loadMemories(),
          loadConversation(),
          loadLocation(),
          loadUserProfile(),
        ]);

      if (savedPrefs) {
        useAppStore.getState().setUserPreferences(savedPrefs);
      }

      if (savedLocation) {
        useAppStore.getState().setCurrentLocation(savedLocation);
      }

      if (savedProfile) {
        useAppStore.getState().setUserProfile(savedProfile);
      }

      // Restore userMode from agent memory
      const savedMode = agent.memory.profile.getUserMode();
      if (savedMode) {
        useAppStore.getState().setUserMode(savedMode);
      }

      // Build the canonical characters list (migrate from legacy single-char if needed)
      let charList: Character[] = savedChars;
      if (charList.length === 0 && savedChar) {
        charList = [savedChar];
        await saveCharacters(charList);
      }
      setCompanions(charList);
      useCharacterStore.getState().setCharacters(charList);

      // Restore the most-recently-active companion (last in list)
      const activeChar = charList.length > 0 ? charList[charList.length - 1] : null;
      if (activeChar) {
        useCharacterStore.getState().setActiveCharacter(activeChar);

        // Load per-companion conversation (fall back to legacy navi_conversation for migration)
        const [perCharMsgs, perCharMems] = await Promise.all([
          loadCharacterConversation(activeChar.id),
          loadCharacterMemories(activeChar.id),
        ]);
        const rawMsgs = perCharMsgs.length > 0 ? perCharMsgs : savedMsgs;
        // Strip persisted error messages so stale failures don't show on reload
        const msgs = rawMsgs.filter(m => {
          if (m.role !== 'character') return true;
          const c = m.content ?? '';
          return !c.startsWith('NAVI is experiencing') &&
                 !c.startsWith('OpenRouter error') &&
                 !c.startsWith('OpenRouter request timed out') &&
                 c !== 'Hmm, let me try that again... 🔄';
        });
        if (msgs.length > 0) {
          useChatStore.setState({ messages: msgs });
          // Migrate: write into per-char key so future loads use it
          if (perCharMsgs.length === 0 && msgs.length > 0) {
            await saveCharacterConversation(activeChar.id, msgs);
          }
        }

        const mems = perCharMems.length > 0 ? perCharMems : savedMemories;
        mems.forEach((m) => useCharacterStore.getState().addMemory(m));

        setCharacter(mapCharacterToUI(activeChar));
        setLocation(
          savedLocation
            ? `${savedLocation.city}, ${savedLocation.country}`
            : `${activeChar.location_city}, ${activeChar.location_country}`,
        );

        // Set up the avatar in the agent framework
        const avatarProfile = agent.createAvatarFromTemplate(
          activeChar.template_id ?? 'default',
          savedLocation?.city ?? activeChar.location_city,
          activeChar.dialect_key ?? savedLocation?.dialectKey,
        );
        avatarProfile.name = activeChar.name;
        avatarProfile.personality = activeChar.summary;
        agent.setAvatar(avatarProfile);
      }

      const targetPhase: AppPhase = activeChar ? 'home' : 'onboarding';

      // First launch: auto-set webllm default (skip backend selection screen)
      if (!localStorage.getItem('navi_backend_pref')) {
        if (isWebGPUSupported()) {
          localStorage.setItem('navi_backend_pref', 'webllm');
          localStorage.setItem('navi_webllm_preset', 'qwen3-1.7b');
        } else {
          // No WebGPU — user must pick a cloud model
          setAppPhase('backend_select');
          return;
        }
      }

      // First launch (no character): go straight to avatar selection
      // Model download happens after the user picks a companion
      if (!activeChar) {
        setAppPhase('onboarding');
        return;
      }

      // Check if LLM is already ready (e.g., Ollama is running and was auto-detected)
      if (agent.isLLMReady()) {
        setAppPhase(targetPhase);
        return;
      }

      // Load the LLM model via the agent framework
      setAppPhase('downloading');
      try {
        await loadLLM();
      } catch (err) {
        console.error('Model load failed:', err);
      }
      setAppPhase(targetPhase);
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Called after the user selects a backend (from Settings or no-WebGPU fallback)
  const handleBackendChosen = async () => {
    const activeBackend = agent.getBackend();
    if (activeBackend === 'webllm' && !isWebGPUSupported()) {
      setAppPhase('no_webgpu');
      return;
    }
    if (!agent.isLLMReady()) {
      setAppPhase('downloading');
      try {
        await loadLLM();
      } catch (err) {
        console.error('Model load failed:', err);
      }
    }
    const activeChar = useCharacterStore.getState().activeCharacter;
    setAppPhase(activeChar ? 'home' : 'onboarding');
  };

  // Called when the user picks an avatar template — creates character from template defaults
  const handleAvatarSelected = async (template: AvatarTemplate, locationCtx: LocationContext | null) => {
    const city = locationCtx?.city ?? 'Ho Chi Minh City';
    const country = locationCtx?.country ?? 'Vietnam';
    const dialectKey = locationCtx?.dialectKey ?? '';

    // Create character from template (no LLM needed)
    const isCustom = template.id === 'custom';
    const charName = isCustom ? template.label : template.label;
    const newChar: Character = {
      id: `char_${Date.now()}`,
      name: charName,
      summary: template.base_personality,
      detailed: isCustom ? template.base_personality : '',
      style: template.default_style,
      emoji: template.emoji,
      avatar_color: { primary: '#6BBAA7', secondary: '#D4A853', accent: '#F5F0EB' },
      avatar_accessory: template.emoji,
      speaks_like: 'warm and conversational',
      template_id: isCustom ? null : template.id,
      location_city: city,
      location_country: country,
      dialect_key: dialectKey,
      first_message: isCustom
        ? `Hey! I'm ${charName}. Ready to explore ${city} together?`
        : `Hey! I'm your ${template.label.toLowerCase()}. Ready to explore ${city}?`,
    };

    // Save to stores + IndexedDB
    useCharacterStore.getState().setActiveCharacter(newChar);
    const updated = [...companions.filter(c => c.id !== newChar.id), newChar];
    setCompanions(updated);
    useCharacterStore.getState().setCharacters(updated);
    await saveCharacters(updated);
    await saveCharacter(newChar);

    if (locationCtx) {
      useAppStore.getState().setCurrentLocation(locationCtx);
      await saveLocation(locationCtx);
    }

    // Add first message to chat
    const firstMsg: Message = {
      id: Date.now().toString(),
      role: 'character',
      content: newChar.first_message!,
      type: 'text',
      timestamp: Date.now(),
      showAvatar: true,
    };
    useChatStore.getState().clearMessages();
    useChatStore.setState({ messages: [firstMsg] });
    await saveCharacterConversation(newChar.id, [firstMsg]);

    // Set up agent avatar
    if (isCustom) {
      const avatarProfile = agent.avatar.createFromDescription(
        newChar.summary,
        {
          name: newChar.name,
          personality: newChar.summary,
          speaksLike: 'warm and conversational',
          energyLevel: 'medium',
          humorStyle: 'warm',
          slangLevel: 0.5,
          dialect: dialectKey,
          culturalContext: '',
          location: city,
          scenario: '',
          visual: {
            primaryColor: '#6BBAA7',
            secondaryColor: '#D4A853',
            accentColor: '#F5F0EB',
            accessory: '✨',
            emoji: '✨',
          },
        },
        city,
      );
      agent.setAvatar(avatarProfile);
    } else {
      const avatarProfile = agent.createAvatarFromTemplate(
        template.id,
        city,
        dialectKey,
      );
      avatarProfile.name = newChar.name;
      avatarProfile.personality = newChar.summary;
      agent.setAvatar(avatarProfile);
    }

    setCharacter(mapCharacterToUI(newChar));
    setLocation(`${city}, ${country}`);

    // Download model if not yet ready
    if (!agent.isLLMReady()) {
      setAppPhase('downloading');
      try {
        await loadLLM();
      } catch (err) {
        console.error('Model load failed:', err);
      }
    }

    setAppPhase('chat');
  };

  // Select a companion from the HomeScreen list
  const handleSelectCompanion = async (charId: string) => {
    const char = companions.find((c) => c.id === charId);
    if (!char) return;

    const [msgs, mems] = await Promise.all([
      loadCharacterConversation(char.id),
      loadCharacterMemories(char.id),
    ]);

    useCharacterStore.getState().setActiveCharacter(char);
    useCharacterStore.getState().clearMemories();
    mems.forEach((m) => useCharacterStore.getState().addMemory(m));
    useChatStore.setState({ messages: msgs });

    // Update agent avatar for the selected companion
    // Resolve dialect key: prefer stored value, fall back to dialectMap scan
    const dialectMap = dialectMapRaw as Record<string, unknown>;
    const storedDialectKey = char.dialect_key ?? '';
    const scannedDialectKey = storedDialectKey
      ? storedDialectKey
      : Object.keys(dialectMap).find(
          (k) => k.split('/')[1]?.toLowerCase() === char.location_city.toLowerCase(),
        ) ?? '';
    const dialectKey = scannedDialectKey;
    const dialectInfo = dialectKey
      ? (dialectMap as Record<string, DialectInfo>)[dialectKey] ?? null
      : null;

    const avatarProfile = agent.avatar.createFromDescription(
      char.detailed || char.summary,
      {
        name: char.name,
        personality: char.detailed || char.summary,
        speaksLike: char.speaks_like || 'a friendly local',
        energyLevel: (['energetic', 'playful'].includes(char.style) ? 'high'
          : ['mysterious', 'dry-humor'].includes(char.style) ? 'low'
          : 'medium') as 'low' | 'medium' | 'high',
        humorStyle: (['playful', 'dry-humor'].includes(char.style) ? char.style : 'warm') as string,
        slangLevel: (['casual', 'streetwise', 'energetic', 'playful'].includes(char.style) ? 0.7 : 0.4),
        dialect: dialectInfo?.dialect ?? dialectKey,
        culturalContext: dialectInfo?.cultural_notes ?? '',
        location: char.location_city,
        scenario: '',
        visual: {
          primaryColor: char.avatar_color?.primary ?? '#6BBAA7',
          secondaryColor: char.avatar_color?.secondary ?? '#D4A853',
          accentColor: char.avatar_color?.accent ?? '#F5F0EB',
          accessory: char.avatar_accessory ?? char.emoji ?? '🌍',
          emoji: char.emoji ?? '🌍',
        },
      },
      char.location_city,
    );
    agent.setAvatar(avatarProfile);

    // Always sync agent's internal location context — even if no dialect mapping exists
    const countryCode = dialectKey ? dialectKey.split('/')[0] : '';
    const locCtx: LocationContext = {
      city: char.location_city,
      country: char.location_country,
      countryCode,
      lat: 0,
      lng: 0,
      dialectKey,
      dialectInfo: dialectInfo ?? null,
    };
    agent.location.setLocation(locCtx, 'manual');
    useAppStore.getState().setCurrentLocation(locCtx);

    setCharacter(mapCharacterToUI(char));
    setLocation(`${char.location_city}, ${char.location_country}`);
    setAppPhase('chat');
  };

  // Regenerate the ACTIVE companion (remove it, go to onboarding to create a replacement)
  const handleRegenerate = async () => {
    const currentChar = useCharacterStore.getState().activeCharacter;
    if (currentChar) {
      const updated = companions.filter((c) => c.id !== currentChar.id);
      setCompanions(updated);
      useCharacterStore.getState().setCharacters(updated);
      await saveCharacters(updated);
    }
    useCharacterStore.getState().setActiveCharacter(null);
    useCharacterStore.getState().clearMemories();
    useChatStore.getState().clearMessages();
    setCharacter(null);
    setLocation('');
    setAppPhase('onboarding');
  };

  // Delete any companion by ID — cleans up all associated IndexedDB data
  const handleDeleteCompanion = async (charId: string) => {
    const updated = companions.filter((c) => c.id !== charId);
    setCompanions(updated);
    useCharacterStore.getState().setCharacters(updated);
    await saveCharacters(updated);
    await deleteCharacterData(charId);

    // If the deleted companion was the active one, return to home
    const active = useCharacterStore.getState().activeCharacter;
    if (active?.id === charId) {
      useCharacterStore.getState().setActiveCharacter(null);
      useCharacterStore.getState().clearMemories();
      useChatStore.getState().clearMessages();
      setCharacter(null);
      setLocation('');
      setAppPhase('home');
    }
  };

  // Update active companion's data (from Settings edit)
  const handleUpdateCharacter = async (updates: Partial<Character>) => {
    useCharacterStore.getState().updateActiveCharacter(updates);
    const updated = useCharacterStore.getState().activeCharacter;
    if (!updated) return;
    const updatedList = useCharacterStore.getState().characters;
    setCompanions(updatedList);
    await saveCharacters(updatedList);
    await saveCharacter(updated);
    setCharacter(mapCharacterToUI(updated));
    setLocation(`${updated.location_city}, ${updated.location_country}`);
    agent.avatar.applyOverride({ location: updated.location_city });

    // Resolve dialect for updated city and sync agent location
    const updatedDialectKey = updated.dialect_key
      ?? Object.keys(dialectMapRaw as Record<string, unknown>).find(
        (k) => k.split('/')[1]?.toLowerCase() === updated.location_city.toLowerCase()
      ) ?? '';
    const updatedDialectInfo = updatedDialectKey
      ? (dialectMapRaw as Record<string, DialectInfo>)[updatedDialectKey] ?? null
      : null;
    const updatedCountryCode = updatedDialectKey ? updatedDialectKey.split('/')[0] : '';
    const updatedLocCtx: LocationContext = {
      city: updated.location_city,
      country: updated.location_country,
      countryCode: updatedCountryCode,
      lat: 0,
      lng: 0,
      dialectKey: updatedDialectKey,
      dialectInfo: updatedDialectInfo,
    };
    agent.location.setLocation(updatedLocCtx, 'manual');
    useAppStore.getState().setCurrentLocation(updatedLocCtx);
  };

  const handleGoHome = () => setAppPhase('home');

  const handleOpenScenarios = (preselectedKey?: string) => {
    setShowScenarioLauncher(true);
    // If a specific scenario key was passed (from HomeScreen tile), auto-start it
    if (preselectedKey) {
      // Short delay to let the launcher mount, then trigger the scenario
      setTimeout(() => {
        // The ScenarioLauncher itself handles the UI; pre-selection would need prop drilling
        // For now, opening the launcher is sufficient — user sees it pre-highlighted
      }, 50);
    }
  };

  const handleStartScenario = (templateKey: ScenarioKey | 'custom', context: ParsedScenarioContext) => {
    setShowScenarioLauncher(false);

    // Store scenario context in the chat store
    const { setScenario, setScenarioContext, setScenarioActive } = useChatStore.getState();

    if (templateKey !== 'custom') {
      setScenario(templateKey);
    }
    setScenarioContext(context);
    setScenarioActive(true);

    // Build a summary string from the user's context inputs
    const contextSummary = buildContextSummary(context);

    // Apply to the avatar — scenario template + user's specific context
    if (templateKey !== 'custom') {
      agent.avatar.applyOverride({
        scenario: templateKey,
        additionalContext: contextSummary ? `USER CONTEXT: ${contextSummary}` : undefined,
      });
    } else {
      // Custom scenario: inject the free text as additional context
      agent.avatar.applyOverride({
        scenario: '',
        additionalContext: context.customText
          ? `SCENARIO: ${context.customText}`
          : undefined,
      });
    }

    // Navigate to chat if not already there
    if (appPhase !== 'chat') {
      // Activate the most-recent companion if one exists
      const activeChar = useCharacterStore.getState().activeCharacter;
      if (activeChar) {
        setCharacter(mapCharacterToUI(activeChar));
        setAppPhase('chat');
      }
    }
  };

  const handleToggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const handleRetryModel = async () => {
    setAppPhase('downloading');
    try {
      await loadLLM();
    } catch (err) {
      console.error('Model retry failed:', err);
    }
    setAppPhase('onboarding');
  };

  // Update user profile and persist
  const handleSaveUserProfile = async (text: string) => {
    useAppStore.getState().setUserProfile(text);
    await saveUserProfile(text);
  };

  // Backend selection (Settings model picker or no-WebGPU fallback)
  if (appPhase === 'backend_select') {
    return <BackendSelectScreen onDone={handleBackendChosen} />;
  }

  // WebGPU not supported (and Ollama not available)
  if (appPhase === 'no_webgpu') {
    return (
      <div className="relative w-full max-w-md mx-auto min-h-screen shadow-2xl flex flex-col items-center justify-center px-8 bg-background text-center gap-4">
        <p className="text-5xl">😔</p>
        <h2 className="text-xl font-medium text-foreground">WebGPU not supported</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your browser doesn't support on-device AI.{' '}
          Try <strong>Chrome 113+</strong> or <strong>Edge 113+</strong> on desktop,
          or install <strong>Ollama</strong> for local model serving.
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
          progressText={loadStatusText}
        />
      </div>
    );
  }

  const messages   = useChatStore.getState().messages;
  const memoryCount = useCharacterStore.getState().memories.length;
  const lastMsg    = messages.filter((m) => m.role !== 'system').at(-1);

  const activeChar = useCharacterStore.getState().activeCharacter;

  return (
    <div className="relative w-full max-w-md mx-auto min-h-screen shadow-2xl">
      <Navbar
        onGoHome={handleGoHome}
        onEdit={appPhase === 'home' && activeChar ? () => setShowHomeSettings(true) : undefined}
        onSettings={appPhase === 'home' ? () => setShowHomeSettings(true) : undefined}
      />

      {appPhase === 'home' ? (
        <HomeScreen
          companions={companions}
          messageCount={messages.length}
          lastMessagePreview={lastMsg?.content?.slice(0, 120) ?? ''}
          memoryCount={memoryCount}
          onSelectCompanion={handleSelectCompanion}
          onContinueChat={() => setAppPhase('chat')}
          onOpenScenarios={handleOpenScenarios}
          onDeleteCompanion={handleDeleteCompanion}
          onNewCompanion={() => {
            // Don't clear — just add a new companion
            useCharacterStore.getState().setActiveCharacter(null);
            useCharacterStore.getState().clearMemories();
            useChatStore.getState().clearMessages();
            setCharacter(null);
            setLocation('');
            setAppPhase('onboarding');
          }}
        />
      ) : appPhase === 'onboarding' ? (
        <AvatarSelectScreen
          onSelect={handleAvatarSelected}
        />
      ) : character ? (
        <>
          <ConversationScreen
            character={character}
            location={location}
            onOpenCamera={() => setShowCamera(true)}
            onToggleTheme={handleToggleTheme}
            onRegenerate={handleRegenerate}
            onDeleteCompanion={handleDeleteCompanion}
            onGoHome={handleGoHome}
            onUpdateCharacter={handleUpdateCharacter}
            onSaveUserProfile={handleSaveUserProfile}
            onOpenScenarios={handleOpenScenarios}
            onShowModelPicker={() => {
              localStorage.removeItem('navi_backend_pref');
              setAppPhase('backend_select');
            }}
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

      {/* Settings panel — accessible from home screen Navbar buttons */}
      {showHomeSettings && (
        <SettingsPanel
          onClose={() => setShowHomeSettings(false)}
          onRegenerate={handleRegenerate}
          onDeleteCompanion={handleDeleteCompanion}
          onUpdateCharacter={handleUpdateCharacter}
          onSaveUserProfile={handleSaveUserProfile}
          onShowModelPicker={() => {
            setShowHomeSettings(false);
            localStorage.removeItem('navi_backend_pref');
            setAppPhase('backend_select');
          }}
        />
      )}

      {/* Scenario Launcher — accessible from both home and chat */}
      <AnimatePresence>
        {showScenarioLauncher && (
          <ScenarioLauncher
            onStart={handleStartScenario}
            onClose={() => setShowScenarioLauncher(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
