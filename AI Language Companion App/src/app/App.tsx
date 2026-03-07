import React, { useState, useEffect } from 'react';
import { NewOnboardingScreen } from './components/NewOnboardingScreen';
import { ConversationScreen } from './components/ConversationScreen';
import { CameraOverlay } from './components/CameraOverlay';
import { ModelDownloadScreen } from './components/ModelDownloadScreen';
import { HomeScreen } from './components/HomeScreen';
import { ScenarioLauncher, buildContextSummary } from './components/ScenarioLauncher';
import { Navbar } from './components/Navbar';
import { AnimatePresence } from 'motion/react';
import type { ScenarioKey, ParsedScenarioContext } from '../types/config';
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
  saveUserProfile,
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

type AppPhase = 'init' | 'no_webgpu' | 'downloading' | 'home' | 'onboarding' | 'chat';

export default function App() {
  const [appPhase, setAppPhase]             = useState<AppPhase>('init');
  const [character, setCharacter]           = useState<GeneratedCharacter | null>(null);
  const [location, setLocation]             = useState('');
  const [isDark, setIsDark]                 = useState(true);
  const [showCamera, setShowCamera]         = useState(false);
  const [showScenarioLauncher, setShowScenarioLauncher] = useState(false);
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
        const msgs = perCharMsgs.length > 0 ? perCharMsgs : savedMsgs;
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
        );
        avatarProfile.name = activeChar.name;
        avatarProfile.personality = activeChar.summary;
        agent.setAvatar(avatarProfile);
      }

      const targetPhase: AppPhase = activeChar ? 'home' : 'onboarding';

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

  // Called when onboarding finishes — add the new companion to the list
  const handleOnboardingComplete = async (generatedCharacter: GeneratedCharacter, selectedLocation: string) => {
    const newChar = useCharacterStore.getState().activeCharacter;
    if (newChar) {
      const updated = [...companions.filter((c) => c.id !== newChar.id), newChar];
      setCompanions(updated);
      useCharacterStore.getState().setCharacters(updated);
      await saveCharacters(updated);
    }
    setCharacter(generatedCharacter);
    setLocation(selectedLocation);

    // Set up the avatar in the agent framework from the generated character
    const activeChar = useCharacterStore.getState().activeCharacter;
    if (activeChar) {
      const avatarProfile = agent.createAvatarFromTemplate(
        activeChar.template_id ?? 'default',
        selectedLocation,
      );
      avatarProfile.name = activeChar.name;
      avatarProfile.personality = activeChar.summary;
      agent.setAvatar(avatarProfile);
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
    const avatarProfile = agent.createAvatarFromTemplate(
      char.template_id ?? 'default',
      char.location_city,
    );
    avatarProfile.name = char.name;
    avatarProfile.personality = char.summary;
    agent.setAvatar(avatarProfile);

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
  };

  const handleGoHome = () => setAppPhase('home');

  const handleOpenScenarios = () => setShowScenarioLauncher(true);

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

  return (
    <div className="relative w-full max-w-md mx-auto min-h-screen shadow-2xl">
      <Navbar onGoHome={handleGoHome} />

      {appPhase === 'home' ? (
        <HomeScreen
          companions={companions}
          messageCount={messages.length}
          lastMessagePreview={lastMsg?.content?.slice(0, 120) ?? ''}
          memoryCount={memoryCount}
          onSelectCompanion={handleSelectCompanion}
          onContinueChat={() => setAppPhase('chat')}
          onOpenScenarios={handleOpenScenarios}
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
        <NewOnboardingScreen
          onComplete={handleOnboardingComplete}
          onRetryLoadModel={handleRetryModel}
        />
      ) : character ? (
        <>
          <ConversationScreen
            character={character}
            location={location}
            onOpenCamera={() => setShowCamera(true)}
            onToggleTheme={handleToggleTheme}
            onRegenerate={handleRegenerate}
            onGoHome={handleGoHome}
            onUpdateCharacter={handleUpdateCharacter}
            onSaveUserProfile={handleSaveUserProfile}
            onOpenScenarios={handleOpenScenarios}
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
