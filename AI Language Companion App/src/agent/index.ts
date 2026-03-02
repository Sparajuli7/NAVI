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
} from './core/types';

// Memory
export { MemoryManager } from './memory';

// Models
export {
  ModelRegistry,
  LLMProvider,
  LLM_PRESETS,
  OllamaProvider,
  OLLAMA_PRESETS,
  isOllamaAvailable,
  listOllamaModels,
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
import { ModelRegistry, LLMProvider, LLM_PRESETS, OllamaProvider, OLLAMA_PRESETS, isOllamaAvailable, TTSProvider, STTProvider, VisionProvider, EmbeddingProvider, TranslationProvider } from './models';
import type { ChatLLM } from './models';
import { AvatarContextController } from './avatar/contextController';
import { LocationIntelligence } from './location/locationIntelligence';
import { registerAllTools } from './tools';
import { handleUserInput } from './core/router';
import { agentBus } from './core/eventBus';
import type { ToolResult, EnergyMode, AvatarProfile } from './core/types';

/** LLM backend selection */
export type LLMBackend = 'webllm' | 'ollama' | 'auto';

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

  // LLM provider — can be WebLLM or Ollama (both implement ChatLLM)
  private llm: ChatLLM;
  private llmBackend: LLMBackend;

  // Direct provider references for convenience
  private webllmProvider: LLMProvider | null = null;
  private ollamaProvider: OllamaProvider | null = null;
  private ttsProvider: TTSProvider;
  private sttProvider: STTProvider;
  private visionProvider: VisionProvider;
  private embeddingProvider: EmbeddingProvider;
  private translationProvider: TranslationProvider;

  private initialized = false;
  private config: NaviAgentConfig;

  constructor(config: NaviAgentConfig = {}) {
    this.config = config;

    // Initialize subsystems
    this.models = new ModelRegistry();
    this.memory = new MemoryManager(config.workingMemoryCapacity ?? 32);
    this.avatar = new AvatarContextController();
    this.location = new LocationIntelligence();

    // Determine backend — 'auto' is resolved during initialize()
    this.llmBackend = config.backend ?? 'auto';

    // Create the LLM provider based on backend selection
    // For 'auto', default to webllm now; will switch in initialize() if Ollama is available
    if (this.llmBackend === 'ollama') {
      this.ollamaProvider = this.createOllamaProvider(config);
      this.llm = this.ollamaProvider;
    } else {
      // 'webllm' or 'auto' (auto defaults to webllm, may switch later)
      const presetKey = config.llmPreset ?? 'qwen2.5-1.5b';
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

    // Auto-detect backend
    if (this.llmBackend === 'auto') {
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
    if (this.ollamaProvider && this.llmBackend === 'ollama') {
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
    const contextParams: Record<string, unknown> = {
      ...options?.context,
    };

    if (options?.history) {
      contextParams.history = options.history;
    }

    if (options?.onToken) {
      contextParams.onToken = options.onToken;
    }

    const { decision, result } = await handleUserInput(message, contextParams);

    // Extract response string from tool result
    let response = '';
    if (result.success && result.data) {
      const data = result.data as Record<string, unknown>;
      response = (data.response as string) ?? JSON.stringify(data);
    } else {
      response = result.error ?? 'Sorry, something went wrong. Try again.';
    }

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
    const { result } = await handleUserInput('Read this image', {
      imageData: image,
      onOCRProgress: callbacks?.onOCRProgress,
      onExplanationToken: callbacks?.onExplanationToken,
    });
    return result;
  }

  /**
   * Create or set the active avatar.
   */
  setAvatar(profile: AvatarProfile): void {
    this.avatar.setActiveProfile(profile);
  }

  createAvatarFromTemplate(templateId: string, location?: string): AvatarProfile {
    const loc = location ?? this.location.getLocation()?.city ?? 'Unknown';
    return this.avatar.createFromTemplate(templateId, loc);
  }

  /**
   * Get system status for debugging / settings UI.
   */
  getStatus(): {
    initialized: boolean;
    llmReady: boolean;
    backend: LLMBackend;
    models: Array<{ id: string; capability: string; status: string }>;
    memory: { working: number; episodic: number; semantic: number };
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
