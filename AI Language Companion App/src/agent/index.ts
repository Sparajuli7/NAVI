/**
 * NAVI Agent Framework — Main Entry Point
 *
 * This is the single import point for the entire agent framework.
 * It creates, configures, and exposes the NaviAgent instance that
 * the React app interacts with.
 *
 * Usage:
 *   import { createNaviAgent } from './agent';
 *   const agent = createNaviAgent();
 *   await agent.initialize();
 *   const result = await agent.handleMessage('How do I say hello?');
 */

// Core
export { agentBus } from './core/eventBus';
export { toolRegistry } from './core/toolRegistry';
export { routeIntent, handleUserInput } from './core/router';
export { executeTool, executeChain, createExecutionContext } from './core/executionEngine';
export type {
  ToolName,
  ToolRequest,
  ToolResult,
  ExecutionConstraints,
  ExecutionContext,
  ModelCapability,
  ModelStatus,
  ModelInfo,
  ModelProvider,
  AvatarProfile,
  AvatarContextOverride,
  EnergyMode,
  EnergyProfile,
  AgentEvent,
  AgentEventType,
  ProfileMemory,
  // Learner + Relationship types
  PhraseAttempt,
  TrackedPhrase,
  PhraseMastery,
  TopicProficiency,
  LearnerProfile,
  SharedMilestone,
  RelationshipState,
  // Situation model types
  SituationModel,
  Urgency,
  ComfortLevel,
  PrimaryGoal,
  // Knowledge Graph types
  GraphNode,
  GraphEdge,
  NodeType,
  EdgeType,
  ConversationNode,
  TermNode,
  TopicNode,
  ScenarioNode,
  AvatarGraphNode,
  LocationNode,
  NodeMetadata,
  EncounterType,
  ConversationMood,
  // Context injection protocol types
  ContextPacket,
  MemoryQuery,
  ResearchRecommendation,
  TurnContext,
  TermContext,
  EngagementPattern,
  TermHistory,
  StruggleContext,
  SessionRecap,
  ReadinessAssessment,
} from './core/types';

// Memory
export { MemoryManager, LearnerProfileStore, RelationshipStore, SituationAssessor, KnowledgeGraphStore, MemoryMaker } from './memory';

// Sub-agents
export { MemoryRetrievalAgent } from './agents/memoryRetrievalAgent';
export { ResearchAgent } from './agents/researchAgent';

// Director
export { ConversationDirector } from './director/conversationDirector';
export type { ConversationGoal, DirectorContext } from './director/conversationDirector';

// Prompts
export { promptLoader, PromptLoader } from './prompts/promptLoader';
export { detectPhrases, detectTopics } from './prompts/phraseDetector';

// Models
export {
  ModelRegistry,
  LLMProvider,
  LLM_PRESETS,
  OllamaProvider,
  OLLAMA_PRESETS,
  isOllamaAvailable,
  listOllamaModels,
  OpenRouterProvider,
  TTSProvider,
  STTProvider,
  VisionProvider,
  EmbeddingProvider,
  TranslationProvider,
} from './models';
export type { ChatLLM, ChatOptions } from './models';

// Avatar
export { AvatarContextController } from './avatar/contextController';

// Location
export { LocationIntelligence } from './location/locationIntelligence';

// Pipelines
export { analyzeImage } from './pipelines/imageUnderstanding';
export { practicePronunciation } from './pipelines/pronunciation';

// Tools
export { registerAllTools } from './tools';

// ─── NaviAgent: The unified agent instance ─────────────────────

import { MemoryManager } from './memory';
import { ModelRegistry, LLMProvider, LLM_PRESETS, OllamaProvider, OLLAMA_PRESETS, isOllamaAvailable, listOllamaModels, OpenRouterProvider, OPENROUTER_FREE_MODELS, OPENROUTER_PAID_MODELS, TTSProvider, STTProvider, VisionProvider, EmbeddingProvider, TranslationProvider } from './models';
import type { ChatLLM } from './models';
import { AvatarContextController } from './avatar/contextController';
import { LocationIntelligence } from './location/locationIntelligence';
import { ConversationDirector } from './director/conversationDirector';
import { SessionPlanner } from './director/SessionPlanner';
import { ProactiveEngine } from './director/ProactiveEngine';
import { MemoryRetrievalAgent } from './agents/memoryRetrievalAgent';
import { ResearchAgent } from './agents/researchAgent';
import type { ResearchQuery } from './agents/researchAgent';
import { registerAllTools } from './tools';
import { handleUserInput } from './core/router';
import { agentBus } from './core/eventBus';
import { detectPhrases, detectTopics } from './prompts/phraseDetector';
import { buildPronunciationBank } from '../utils/pronunciationLookup';
import type { ToolResult, EnergyMode, AvatarProfile, ProfileMemory, ContextPacket, ResearchRecommendation, TurnContext, TermNode, ConversationNode } from './core/types';

// ─── Mode Keyword Classifier ────────────────────────────────────

const MODE_SIGNALS: Record<'learn' | 'guide' | 'friend', string[]> = {
  learn: ['teach', 'learn', 'practice', 'immerse', 'how do i say', 'how do you say', 'what does', 'say it again', 'what is the word', 'help me pronounce', 'study', 'drill', 'quiz me'],
  guide: ['translate', 'what are they saying', 'help me understand', 'i don\'t understand', 'lost', 'navigate', 'need to say', 'what does this mean', 'how do i get', 'how do i ask', 'i need to tell'],
  friend: ['ugh', 'terrible', 'scammed', 'frustrated', 'can you believe', 'just wanna talk', 'venting', 'awful', 'so annoying', 'this is the worst', 'i can\'t believe', 'wtf', 'omg', 'stressed'],
};

/** Rolling signal accumulator — counts keyword hits across recent messages */
class ModeClassifier {
  private scores: Record<'learn' | 'guide' | 'friend', number> = { learn: 0, guide: 0, friend: 0 };
  private messageCount = 0;
  private locked = false;
  private lockedMode: 'learn' | 'guide' | 'friend' | null = null;

  /** Analyze a message and return the mode if threshold crossed */
  analyze(message: string): 'learn' | 'guide' | 'friend' | null {
    if (this.locked) return this.lockedMode;

    const lower = message.toLowerCase();
    this.messageCount++;

    // Check for signals in each mode
    for (const [mode, keywords] of Object.entries(MODE_SIGNALS) as Array<['learn' | 'guide' | 'friend', string[]]>) {
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          this.scores[mode]++;
          break; // only count one keyword per mode per message
        }
      }
    }

    // Check if any mode crossed threshold (2 signals within last 5 messages)
    // Reset scores older than 5 messages by decaying
    if (this.messageCount > 0 && this.messageCount % 5 === 0) {
      // Decay scores to keep window rolling
      this.scores.learn = Math.max(0, this.scores.learn - 1);
      this.scores.guide = Math.max(0, this.scores.guide - 1);
      this.scores.friend = Math.max(0, this.scores.friend - 1);
    }

    // Friend wins ties (empathy > guide > learn)
    const threshold = 2;
    if (this.scores.friend >= threshold) {
      this.locked = true;
      this.lockedMode = 'friend';
      return 'friend';
    }
    if (this.scores.guide >= threshold) {
      this.locked = true;
      this.lockedMode = 'guide';
      return 'guide';
    }
    if (this.scores.learn >= threshold) {
      this.locked = true;
      this.lockedMode = 'learn';
      return 'learn';
    }

    return null; // not yet determined
  }

  reset(): void {
    this.scores = { learn: 0, guide: 0, friend: 0 };
    this.messageCount = 0;
    this.locked = false;
    this.lockedMode = null;
  }

  isLocked(): boolean { return this.locked; }
  getCurrentMode(): 'learn' | 'guide' | 'friend' | null { return this.lockedMode; }
}

/** LLM backend selection */
export type LLMBackend = 'webllm' | 'ollama' | 'openrouter' | 'auto';
/** OpenRouter model tier */
export type OpenRouterTier = 'free' | 'paid';

export interface NaviAgentConfig {
  /** Which LLM backend to use: 'webllm' (in-browser), 'ollama' (local server), 'auto' (detect) */
  backend?: LLMBackend;
  /** Which WebLLM preset to use (only for 'webllm' backend) */
  llmPreset?: keyof typeof LLM_PRESETS;
  /** Which Ollama model to use (only for 'ollama' backend) */
  ollamaModel?: string;
  /** Ollama server URL (default: http://localhost:11434) */
  ollamaBaseUrl?: string;
  /** Working memory capacity */
  workingMemoryCapacity?: number;
  /** Energy mode */
  energyMode?: EnergyMode;
}

export class NaviAgent {
  readonly models: ModelRegistry;
  readonly memory: MemoryManager;
  readonly avatar: AvatarContextController;
  readonly location: LocationIntelligence;
  readonly director: ConversationDirector;
  readonly sessionPlanner: SessionPlanner;
  readonly proactiveEngine: ProactiveEngine;
  readonly memoryRetrieval: MemoryRetrievalAgent;
  readonly research: ResearchAgent;

  // LLM provider — can be WebLLM or Ollama (both implement ChatLLM)
  private llm: ChatLLM;
  private llmBackend: LLMBackend;
  private webllmPresetKey: keyof typeof LLM_PRESETS = 'qwen3-1.7b';
  private openRouterTier: OpenRouterTier = 'free';

  // Direct provider references for convenience
  private webllmProvider: LLMProvider | null = null;
  private ollamaProvider: OllamaProvider | null = null;
  private openRouterProvider: OpenRouterProvider | null = null;
  private ttsProvider: TTSProvider;
  private sttProvider: STTProvider;
  private visionProvider: VisionProvider;
  private embeddingProvider: EmbeddingProvider;
  private translationProvider: TranslationProvider;

  private initialized = false;
  private config: NaviAgentConfig;
  private modeClassifier = new ModeClassifier();
  private onModeChange?: (mode: 'learn' | 'guide' | 'friend' | null) => void;
  /** Tracks how many new terms have been introduced in the current session */
  private termsInSession = 0;
  /** Tracks how many turns the user hasn't produced target language */
  private turnsWithoutOutput = 0;

  constructor(config: NaviAgentConfig = {}) {
    this.config = config;

    // Initialize subsystems
    this.models = new ModelRegistry();
    this.memory = new MemoryManager(config.workingMemoryCapacity ?? 32);
    this.avatar = new AvatarContextController();
    this.location = new LocationIntelligence();
    this.director = new ConversationDirector(
      this.memory.learner,
      this.memory.relationships,
      this.memory.episodic,
      this.memory.working,
    );
    this.director.setSituationAssessor(this.memory.situation);

    // Session planner and proactive engine
    this.sessionPlanner = new SessionPlanner(this.memory.working);
    this.proactiveEngine = new ProactiveEngine(this.memory.learner, this.memory.episodic);
    this.director.setSessionPlanner(this.sessionPlanner);

    // Restore persisted backend preference from localStorage (overrides env var and config)
    const _ls = typeof localStorage !== 'undefined' ? localStorage : null;
    const savedBackendPref = _ls?.getItem('navi_backend_pref');
    const savedORKey = _ls?.getItem('navi_openrouter_key') ?? '';
    const savedORTier = (_ls?.getItem('navi_openrouter_tier') ?? 'free') as OpenRouterTier;
    const savedWebllmPreset = _ls?.getItem('navi_webllm_preset');

    if (savedBackendPref === 'webllm' || savedBackendPref === 'openrouter') {
      config = { ...config, backend: savedBackendPref };
      if (savedBackendPref === 'webllm' && savedWebllmPreset && savedWebllmPreset in LLM_PRESETS) {
        config = { ...config, llmPreset: savedWebllmPreset as keyof typeof LLM_PRESETS };
      }
    }
    if (savedWebllmPreset && savedWebllmPreset in LLM_PRESETS) {
      this.webllmPresetKey = savedWebllmPreset as keyof typeof LLM_PRESETS;
    }
    this.openRouterTier = savedORTier;

    // Sub-agents — Memory Retrieval + Research
    this.memoryRetrieval = new MemoryRetrievalAgent(this.memory.graph);
    this.research = new ResearchAgent();

    // Determine backend — 'auto' is resolved during initialize()
    this.llmBackend = config.backend ?? 'auto';

    // OpenRouter takes priority when the env key is present (supports comma-separated keys)
    // Falls back to localStorage key if env var is absent
    const rawKey = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
    const openRouterKeys = rawKey
      ? rawKey.split(',').map((k: string) => k.trim()).filter(Boolean)
      : savedORKey ? [savedORKey] : [];

    // Create the LLM provider based on backend selection
    // Only use OpenRouter when the user explicitly chose it (savedBackendPref === 'openrouter').
    // An env key alone must NOT override 'auto' or 'webllm' — that would fire OpenRouter before
    // the user has visited BackendSelectScreen on first run.
    if (openRouterKeys.length > 0 && this.llmBackend === 'openrouter') {
      // OpenRouter cloud mode — no local model download needed
      this.openRouterProvider = new OpenRouterProvider(openRouterKeys);
      this.llm = this.openRouterProvider;
      this.llmBackend = 'openrouter';
    } else if (this.llmBackend === 'ollama') {
      this.ollamaProvider = this.createOllamaProvider(config);
      this.llm = this.ollamaProvider;
    } else {
      // 'webllm' or 'auto' (auto defaults to webllm, may switch later in initialize())
      const presetKey = config.llmPreset ?? 'qwen3-1.7b';
      this.webllmPresetKey = presetKey;
      this.webllmProvider = new LLMProvider(LLM_PRESETS[presetKey]);
      this.llm = this.webllmProvider;
    }

    // Create other providers
    this.ttsProvider = new TTSProvider();
    this.sttProvider = new STTProvider();
    this.visionProvider = new VisionProvider();
    this.embeddingProvider = new EmbeddingProvider();
    this.translationProvider = new TranslationProvider();

    // Register all model providers
    if (this.openRouterProvider) this.models.register(this.openRouterProvider);
    if (this.webllmProvider) this.models.register(this.webllmProvider);
    if (this.ollamaProvider) this.models.register(this.ollamaProvider);
    this.models.register(this.ttsProvider);
    this.models.register(this.sttProvider);
    this.models.register(this.visionProvider);
    this.models.register(this.embeddingProvider);
    this.models.register(this.translationProvider);

    // Set energy mode
    if (config.energyMode) {
      this.models.setEnergyMode(config.energyMode);
    }

    // Register all tools (using the ChatLLM interface)
    registerAllTools({
      llmProvider: this.llm,
      ttsProvider: this.ttsProvider,
      sttProvider: this.sttProvider,
      visionProvider: this.visionProvider,
      translationProvider: this.translationProvider,
      avatarController: this.avatar,
      memoryManager: this.memory,
      locationIntelligence: this.location,
    });
  }

  private createOllamaProvider(config: NaviAgentConfig): OllamaProvider {
    const ollamaModel = config.ollamaModel ?? 'qwen2.5:1.5b';
    const preset = OLLAMA_PRESETS[ollamaModel as keyof typeof OLLAMA_PRESETS];
    return new OllamaProvider({
      model: ollamaModel,
      name: preset?.name,
      baseUrl: config.ollamaBaseUrl,
      sizeBytes: preset?.sizeBytes,
    });
  }

  /**
   * Initialize the agent: load memory, detect location.
   * For 'auto' backend, detects if Ollama is available and switches if so.
   * Call this before using the agent. LLM loading is separate (it's slow).
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.llmBackend === 'openrouter') {
      // Cloud mode — key was set in constructor, nothing to detect
      console.log('[NAVI] Using OpenRouter (cloud mode)');
      agentBus.emit('model:status', { backend: 'openrouter', status: 'ready' });
    } else if (this.llmBackend === 'auto') {
      // Auto-detect: prefer Ollama, fall back to WebLLM
      const ollamaUp = await isOllamaAvailable(this.config.ollamaBaseUrl);
      if (ollamaUp) {
        // Ollama is running — use it (faster startup, better models)
        this.ollamaProvider = this.createOllamaProvider(this.config);
        this.llm = this.ollamaProvider;
        this.llmBackend = 'ollama';
        this.models.register(this.ollamaProvider);

        // Re-register tools with the new LLM provider
        registerAllTools({
          llmProvider: this.llm,
          ttsProvider: this.ttsProvider,
          sttProvider: this.sttProvider,
          visionProvider: this.visionProvider,
          translationProvider: this.translationProvider,
          avatarController: this.avatar,
          memoryManager: this.memory,
          locationIntelligence: this.location,
        });

        agentBus.emit('model:status', { backend: 'ollama', status: 'detected' });
      } else {
        // No Ollama — stick with WebLLM
        console.log('[NAVI] Using WebLLM (offline mode)');
        this.llmBackend = 'webllm';
        agentBus.emit('model:status', { backend: 'webllm', status: 'detected' });
      }
    }

    await Promise.all([
      this.memory.initialize(),
      this.location.initialize(),
    ]);

    this.initialized = true;
    agentBus.emit('tool:complete', { action: 'agent_initialized', backend: this.llmBackend });
  }

  /**
   * Load the LLM model (separate from initialize because it's slow).
   * For WebLLM: downloads + compiles the model in-browser.
   * For Ollama: verifies connection and pulls model if needed.
   */
  async loadLLM(
    onProgress?: (progress: number, text: string) => void,
  ): Promise<void> {
    if (this.llmBackend === 'openrouter') {
      // No download needed — OpenRouter is always ready
      return;
    } else if (this.ollamaProvider && this.llmBackend === 'ollama') {
      await this.ollamaProvider.load(onProgress);
    } else if (this.webllmProvider) {
      await this.models.loadModel(this.webllmProvider.info().id, onProgress);
    }
  }

  /** Check if the LLM is ready for inference */
  isLLMReady(): boolean {
    return this.llm.isReady();
  }

  /** Get the active LLM backend */
  getBackend(): LLMBackend {
    return this.llmBackend;
  }

  /** Get the active ChatLLM instance */
  getLLM(): ChatLLM {
    return this.llm;
  }

  /**
   * Handle a user message: route → execute → return result.
   * This is the main entry point for conversation.
   */
  async handleMessage(
    message: string,
    options?: {
      /** Additional context (e.g., imageData for camera) */
      context?: Record<string, unknown>;
      /** Conversation history for context */
      history?: Array<{ role: string; content: string }>;
      /** Streaming callback */
      onToken?: (token: string, full: string) => void;
    },
  ): Promise<{ response: string; tool: string; confidence: number }> {
    console.log(`[NAVI] ════════════════════════════════════════`);
    console.log(`[NAVI] USER INPUT: ${message}`);
    console.log(`[NAVI] ════════════════════════════════════════`);

    // 1. Director pre-processing — build goals + context injection
    const avatarId = this.avatar.getActiveProfile()?.id ?? 'default';
    const historyLen = options?.history?.length ?? 0;
    const isSessionStart = historyLen <= 2; // first message or just the greeting

    // Run keyword classifier on every message — lock mode silently when threshold crossed
    const previousMode = this.modeClassifier.getCurrentMode();
    const detectedMode = this.modeClassifier.analyze(message);
    if (detectedMode !== previousMode && detectedMode !== null) {
      // Mode just locked — persist to memory and notify
      this.memory.profile.setUserMode(detectedMode).catch(() => {});
      if (this.onModeChange) this.onModeChange(detectedMode);
      console.log(`[NAVI] Mode locked: ${detectedMode}`);
    }

    const currentMode = this.modeClassifier.getCurrentMode()
      ?? (this.memory.profile.getUserMode() ?? null);

    const directorCtx = this.director.preProcess(message, avatarId, { isSessionStart, userMode: currentMode });
    agentBus.emit('director:goals_set', { goals: directorCtx.goals });

    // 1b. Sub-agent context gathering (runs in parallel with director)
    const profile = this.avatar.getActiveProfile();
    const locationCtx = this.location.getLocation();
    const currentLanguage = this.location.getPrimaryLanguage();
    const currentDialect = profile?.dialect || '';
    const currentScenario = profile?.scenario || '';

    // Memory Retrieval Agent — get graph-based context
    const memoryContext: ContextPacket = this.memoryRetrieval.retrieve({
      userMessage: message,
      currentTopics: [],
      currentScenario,
      currentLocation: locationCtx?.city || '',
      currentAvatarId: avatarId,
      language: currentLanguage,
      queryType: isSessionStart ? 'session_start' : 'turn_context',
    });

    // Research Agent — get protocol recommendations
    // Detect frustration signals
    const lower = message.toLowerCase();
    const frustrationSignals = /frustrated|confused|don't understand|i can't|this is hard|ugh|stuck|lost/i;
    const userShowingFrustration = frustrationSignals.test(lower);

    // Detect target language output
    const hasTargetLangOutput = /[^\x00-\x7F]/.test(message) && message.length > 3;
    if (hasTargetLangOutput) {
      this.turnsWithoutOutput = 0;
    } else {
      this.turnsWithoutOutput++;
    }

    const researchQuery: ResearchQuery = {
      userMessage: message,
      currentTier: this.memory.learner.languageComfortTier,
      userMode: currentMode,
      recentEngagement: 0.5,
      termsInSession: this.termsInSession,
      turnsWithoutOutput: this.turnsWithoutOutput,
      userShowingFrustration,
      struggleTerms: memoryContext.struggleTerms,
      activeScenario: currentScenario,
      language: currentLanguage,
      script: '',
      location: locationCtx?.city || '',
      encounterContext: currentScenario || 'general conversation',
      inferredReason: '',
    };
    const researchContext: ResearchRecommendation = this.research.getRecommendation(researchQuery);

    // Build combined context injection (merge all sub-agent outputs)
    const subAgentInjections: string[] = [];
    if (memoryContext.promptInjection) subAgentInjections.push(memoryContext.promptInjection);
    if (researchContext.promptInjection) subAgentInjections.push(researchContext.promptInjection);
    const combinedSubAgentContext = subAgentInjections.join('\n\n');

    // Pronunciation reference bank — external API + IndexedDB, must not break message flow
    const pronunciationBank = await buildPronunciationBank(
      currentLanguage,
      this.memory.learner.phrases.slice(0, 5),
    ).catch(() => '');

    // Merge director goals + sub-agent context + pronunciation bank
    const fullConversationGoals = [
      directorCtx.promptInjection,
      combinedSubAgentContext,
      pronunciationBank,
    ].filter(Boolean).join('\n\n');

    const contextParams: Record<string, unknown> = {
      ...options?.context,
      // Inject director context + sub-agent context into tool params
      warmthInstruction: directorCtx.warmthInstruction,
      learningContext: directorCtx.learningContext,
      conversationGoals: fullConversationGoals,
      situationContext: directorCtx.situationContext,
      userMode: currentMode,
      dialectKey: this.avatar.getActiveProfile()?.dialect || undefined,
      isFirstEverMessage: historyLen === 0,
    };

    if (options?.history) {
      contextParams.history = options.history;
    }

    if (options?.onToken) {
      contextParams.onToken = options.onToken;
    }

    // 2. Route + execute tool (existing flow)
    const { decision, result } = await handleUserInput(message, contextParams);

    // Extract response string from tool result
    let response = '';
    if (result.success && result.data) {
      const data = result.data as Record<string, unknown>;
      response = (data.response as string) ?? JSON.stringify(data);
    } else {
      response = result.error ?? 'Sorry, something went wrong. Try again.';
    }

    // 3. Director post-processing — detect phrases, update learner, record interaction
    this.director
      .postProcess(message, response, decision.tool, avatarId)
      .catch((err) => console.error('[NaviAgent] Director postProcess error:', err));

    // 4. Knowledge Graph update via MemoryMaker (fire-and-forget)
    const detectedPhrases = detectPhrases(response);
    const detectedTopicsArr = detectTopics(message + ' ' + response);
    this.termsInSession += detectedPhrases.length;

    const situationModel = this.memory.situation.getModel();
    this.memory.memoryMaker.processExchange({
      userMessage: message,
      assistantResponse: response,
      detectedPhrases,
      detectedTopics: detectedTopicsArr,
      toolUsed: decision.tool,
      avatarId,
      avatarName: profile?.name || 'unknown',
      location: locationCtx?.city || '',
      scenario: currentScenario,
      language: currentLanguage,
      script: '',
      dialectKey: currentDialect,
      userMode: currentMode,
      situationModel,
    }).catch((err) => console.error('[NaviAgent] MemoryMaker error:', err));

    console.log(`[NAVI] ── AGENT OUTPUT (tool=${decision.tool}) ──`);
    console.log(`[NAVI] ${response}`);
    console.log(`[NAVI] ════════════════════════════════════════`);

    return {
      response,
      tool: decision.tool,
      confidence: decision.confidence,
    };
  }

  /**
   * Handle an image from the camera.
   */
  async handleImage(
    image: File | Blob | string,
    callbacks?: {
      onOCRProgress?: (progress: number) => void;
      onExplanationToken?: (token: string, full: string) => void;
    },
  ): Promise<ToolResult> {
    console.log(`[NAVI] ════════════════════════════════════════`);
    console.log(`[NAVI] IMAGE INPUT: ${image instanceof File ? image.name : typeof image}`);
    console.log(`[NAVI] ════════════════════════════════════════`);
    const { result } = await handleUserInput('Read this image', {
      imageData: image,
      onOCRProgress: callbacks?.onOCRProgress,
      onExplanationToken: callbacks?.onExplanationToken,
    });
    console.log(`[NAVI] ── IMAGE OUTPUT (success=${result.success}) ──`);
    return result;
  }

  /**
   * Create or set the active avatar.
   */
  setAvatar(profile: AvatarProfile): void {
    this.avatar.setActiveProfile(profile);
  }

  createAvatarFromTemplate(templateId: string, location?: string, dialectKey?: string): AvatarProfile {
    const loc = location ?? this.location.getLocation()?.city ?? 'Unknown';
    return this.avatar.createFromTemplate(templateId, loc, dialectKey);
  }

  /**
   * Get system status for debugging / settings UI.
   */
  getStatus(): {
    initialized: boolean;
    llmReady: boolean;
    backend: LLMBackend;
    models: Array<{ id: string; capability: string; status: string }>;
    memory: ReturnType<MemoryManager['getStats']>;
    location: { city: string; language: string } | null;
    avatar: string | null;
    energyMode: string;
  } {
    const loc = this.location.getLocation();
    return {
      initialized: this.initialized,
      llmReady: this.isLLMReady(),
      backend: this.llmBackend,
      models: this.models.listModels().map((m) => ({
        id: m.id,
        capability: m.capability,
        status: m.status,
      })),
      memory: this.memory.getStats(),
      location: loc
        ? { city: loc.city, language: this.location.getPrimaryLanguage() }
        : null,
      avatar: this.avatar.getActiveProfile()?.name ?? null,
      energyMode: this.models.getEnergyMode(),
    };
  }

  /** Get proactive suggestions from the conversation director */
  getSuggestions(): string[] {
    const avatarId = this.avatar.getActiveProfile()?.id ?? 'default';
    return this.director.getSuggestions(avatarId);
  }

  /**
   * Call on app open — returns a warm message if a proactive trigger is active,
   * or null if no proactive message is needed (user is in a normal session cadence).
   */
  getProactiveMessage(): string | null {
    return this.proactiveEngine.getProactiveMessage();
  }

  /** Get the current Ollama model name (if using Ollama backend) */
  getOllamaModelName(): string | null {
    return this.ollamaProvider?.getModelName() ?? null;
  }

  /** Get the current Ollama base URL */
  getOllamaBaseUrl(): string {
    return this.config.ollamaBaseUrl ?? 'http://localhost:11434';
  }

  /** Set the Ollama base URL (persists for this session) */
  setOllamaBaseUrl(url: string): void {
    this.config.ollamaBaseUrl = url;
  }

  /** Check if Ollama server is reachable (independent of whether models are pulled) */
  async checkOllamaConnection(baseUrl?: string): Promise<boolean> {
    const url = baseUrl ?? this.config.ollamaBaseUrl;
    return isOllamaAvailable(url);
  }

  /** List all models available in a local Ollama instance */
  async listOllamaModels(baseUrl?: string): Promise<Array<{ name: string; size: number }>> {
    const url = baseUrl ?? this.config.ollamaBaseUrl;
    if (this.ollamaProvider && !baseUrl) {
      return this.ollamaProvider.listAvailableModels();
    }
    return listOllamaModels(url);
  }

  /**
   * Switch to Ollama backend with a specific model.
   * Creates the Ollama provider if it doesn't exist yet (e.g. when switching from WebLLM).
   */
  async switchOllamaModel(
    model: string,
    onProgress?: (progress: number, text: string) => void,
  ): Promise<void> {
    // Create provider if we don't have one yet
    if (!this.ollamaProvider) {
      this.ollamaProvider = this.createOllamaProvider({ ...this.config, ollamaModel: model });
      this.models.register(this.ollamaProvider);
    } else {
      await this.ollamaProvider.switchModel(model);
    }

    // Switch the active LLM to Ollama
    this.llm = this.ollamaProvider;
    this.llmBackend = 'ollama';

    // Re-register tools with the new LLM provider
    registerAllTools({
      llmProvider: this.llm,
      ttsProvider: this.ttsProvider,
      sttProvider: this.sttProvider,
      visionProvider: this.visionProvider,
      translationProvider: this.translationProvider,
      avatarController: this.avatar,
      memoryManager: this.memory,
      locationIntelligence: this.location,
    });

    await this.ollamaProvider.load(onProgress);

    agentBus.emit('model:status', { backend: 'ollama', model, status: 'ready' });
  }

  /** Get the active WebLLM preset key */
  getWebllmPreset(): keyof typeof LLM_PRESETS {
    return this.webllmPresetKey;
  }

  /** Get the active OpenRouter tier */
  getOpenRouterTier(): OpenRouterTier {
    return this.openRouterTier;
  }

  /**
   * Switch the active LLM backend at runtime.
   * For 'webllm': downloads the model if needed.
   * For 'openrouter': ready immediately (no download).
   * Persists the choice to localStorage for next session.
   */
  async switchBackend(
    type: 'webllm' | 'openrouter',
    opts: {
      apiKey?: string;
      webllmPreset?: keyof typeof LLM_PRESETS;
      openRouterTier?: OpenRouterTier;
      openRouterModels?: string[];
    } = {},
    onProgress?: (progress: number, text: string) => void,
  ): Promise<void> {
    const _ls = typeof localStorage !== 'undefined' ? localStorage : null;

    if (type === 'openrouter') {
      const envKey = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_OPENROUTER_API_KEY?.split(',')[0]?.trim() ?? '';
      const key = opts.apiKey?.trim() ?? _ls?.getItem('navi_openrouter_key') ?? envKey ?? '';
      if (!key) throw new Error('An OpenRouter API key is required. Get a free one at openrouter.ai.');

      const tier = opts.openRouterTier ?? 'free';
      const models = opts.openRouterModels ?? (tier === 'paid' ? OPENROUTER_PAID_MODELS : OPENROUTER_FREE_MODELS);

      _ls?.setItem('navi_backend_pref', 'openrouter');
      _ls?.setItem('navi_openrouter_key', key);
      _ls?.setItem('navi_openrouter_tier', tier);

      if (!this.openRouterProvider) {
        this.openRouterProvider = new OpenRouterProvider(key, models);
        this.models.register(this.openRouterProvider);
      } else {
        this.openRouterProvider.setApiKeys(key);
        this.openRouterProvider.setModels(models);
      }

      this.llm = this.openRouterProvider;
      this.llmBackend = 'openrouter';
      this.openRouterTier = tier;

    } else {
      // webllm
      const preset = opts.webllmPreset ?? this.webllmPresetKey;
      if (!(preset in LLM_PRESETS)) throw new Error(`Unknown WebLLM preset: ${preset}`);

      _ls?.setItem('navi_backend_pref', 'webllm');
      _ls?.setItem('navi_webllm_preset', preset);

      // Create a fresh provider if the preset changed
      if (!this.webllmProvider || this.webllmPresetKey !== preset) {
        this.webllmProvider = new LLMProvider(LLM_PRESETS[preset]);
        this.models.register(this.webllmProvider);
      }

      this.llm = this.webllmProvider;
      this.llmBackend = 'webllm';
      this.webllmPresetKey = preset;
    }

    // Re-register all tools with the new LLM
    registerAllTools({
      llmProvider: this.llm,
      ttsProvider: this.ttsProvider,
      sttProvider: this.sttProvider,
      visionProvider: this.visionProvider,
      translationProvider: this.translationProvider,
      avatarController: this.avatar,
      memoryManager: this.memory,
      locationIntelligence: this.location,
    });

    agentBus.emit('model:status', { backend: this.llmBackend, status: 'switching' });

    if (type === 'webllm') {
      await this.loadLLM(onProgress);
    }

    agentBus.emit('model:status', { backend: this.llmBackend, status: 'ready' });
  }

  /** Register a callback for when mode is silently locked by keyword classifier */
  onModeDetected(cb: (mode: 'learn' | 'guide' | 'friend' | null) => void): void {
    this.onModeChange = cb;
  }

  /** Manually override user mode (from settings panel) */
  async setUserMode(mode: 'learn' | 'guide' | 'friend' | null): Promise<void> {
    this.modeClassifier.reset();
    await this.memory.profile.setUserMode(mode);
    if (this.onModeChange) this.onModeChange(mode);
  }

  /** Get current user mode */
  getUserMode(): 'learn' | 'guide' | 'friend' | null {
    return this.modeClassifier.getCurrentMode() ?? this.memory.profile.getUserMode();
  }

  /** Set energy mode */
  setEnergyMode(mode: EnergyMode): void {
    this.models.setEnergyMode(mode);
  }

  /** Subscribe to agent events */
  on(event: Parameters<typeof agentBus.on>[0], listener: Parameters<typeof agentBus.on>[1]) {
    return agentBus.on(event, listener);
  }

  /** Subscribe to all events */
  onAll(listener: Parameters<typeof agentBus.onAll>[0]) {
    return agentBus.onAll(listener);
  }
}

/** Factory function — the recommended way to create a NaviAgent */
export function createNaviAgent(config?: NaviAgentConfig): NaviAgent {
  return new NaviAgent(config);
}
