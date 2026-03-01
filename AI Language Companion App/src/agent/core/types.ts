/**
 * NAVI Agent Framework — Core Type Definitions
 *
 * These types define the contracts for the entire agent system.
 * Every module implements against these interfaces, making it possible
 * to swap implementations without changing consumers.
 */

// ─── Execution Types ───────────────────────────────────────────

export type ToolName =
  | 'chat'
  | 'translate'
  | 'pronounce'
  | 'camera_read'
  | 'explain_culture'
  | 'teach_slang'
  | 'generate_phrase'
  | 'memory_recall'
  | 'memory_store'
  | 'switch_scenario'
  | 'switch_location'
  | 'tts_speak'
  | 'stt_listen';

export interface ToolRequest {
  /** Which tool to invoke */
  tool: ToolName;
  /** Arbitrary params the tool needs */
  params: Record<string, unknown>;
  /** Caller-provided request id for tracking */
  requestId: string;
  /** Timestamp of when the request was created */
  createdAt: number;
}

export interface ToolResult {
  /** Echoes back the request id */
  requestId: string;
  /** Which tool produced this */
  tool: ToolName;
  /** Whether execution succeeded */
  success: boolean;
  /** The output data (tool-specific shape) */
  data: unknown;
  /** Error message if success=false */
  error?: string;
  /** How long the tool took in ms */
  durationMs: number;
  /** Token usage if an LLM was involved */
  tokenUsage?: { prompt: number; completion: number };
}

export interface ExecutionConstraints {
  /** Max recursive tool calls in a single request chain */
  maxRecursionDepth: number;
  /** Max total tokens (prompt + completion) per request */
  maxTokenBudget: number;
  /** Hard timeout in ms for any single tool execution */
  timeoutMs: number;
  /** Whether to allow the agent to chain tools autonomously */
  allowChaining: boolean;
}

export interface ExecutionContext {
  /** Current constraints */
  constraints: ExecutionConstraints;
  /** Current recursion depth */
  depth: number;
  /** Accumulated token usage */
  tokensUsed: number;
  /** Trace of tool calls for debugging */
  trace: ToolResult[];
}

// ─── Model Abstraction Types ───────────────────────────────────

export type ModelCapability = 'llm' | 'embedding' | 'tts' | 'stt' | 'vision' | 'translation';

export type ModelStatus = 'not_loaded' | 'downloading' | 'loading' | 'ready' | 'error' | 'unloaded';

export interface ModelInfo {
  /** Unique identifier for this model */
  id: string;
  /** Human-readable name */
  name: string;
  /** What this model does */
  capability: ModelCapability;
  /** Approximate size in bytes */
  sizeBytes: number;
  /** Runtime required (webllm, onnx, browser-api, wasm) */
  runtime: 'webllm' | 'onnx' | 'browser-api' | 'wasm' | 'custom';
  /** Whether this model is optional or required */
  required: boolean;
  /** Current load status */
  status: ModelStatus;
  /** Quantization format if applicable */
  quantization?: string;
  /** Languages this model supports */
  languages?: string[];
}

export interface ModelProvider<T = unknown> {
  /** Get model info */
  info(): ModelInfo;
  /** Load the model (download + initialize) */
  load(onProgress?: (progress: number, text: string) => void): Promise<void>;
  /** Unload the model to free resources */
  unload(): Promise<void>;
  /** Check if model is ready for inference */
  isReady(): boolean;
  /** Get the underlying engine/runtime for direct access */
  getEngine(): T | null;
}

// ─── Memory Types ──────────────────────────────────────────────

export interface ProfileMemory {
  /** User's native language */
  nativeLanguage: string;
  /** User preferences (age, gender, vocation, etc.) */
  preferences: Record<string, unknown>;
  /** Learning progress markers */
  learningProgress: Record<string, unknown>;
  /** Custom user-provided notes */
  notes: string[];
}

export interface EpisodicMemory {
  id: string;
  /** Summary of what happened */
  summary: string;
  /** When this episode occurred */
  timestamp: number;
  /** Location context when this happened */
  location?: string;
  /** Scenario context */
  scenario?: string;
  /** Importance score 0-1 */
  importance: number;
  /** Tags for retrieval */
  tags: string[];
}

export interface SemanticMemoryEntry {
  id: string;
  /** The text content */
  content: string;
  /** Pre-computed embedding vector */
  embedding: number[];
  /** Metadata for filtering */
  metadata: Record<string, string>;
  /** When this was stored */
  timestamp: number;
}

export interface WorkingMemorySlot {
  /** What this slot contains */
  key: string;
  /** The value */
  value: unknown;
  /** When it was last updated */
  updatedAt: number;
  /** TTL in ms — slot auto-expires after this */
  ttlMs: number;
}

// ─── Avatar Types ──────────────────────────────────────────────

export interface AvatarProfile {
  id: string;
  name: string;
  /** Age group that defines slang level and cultural references */
  ageGroup: 'teen' | '20s' | '30s' | '40s' | '50s' | '60s+';
  /** Dialect this avatar speaks */
  dialect: string;
  /** Profession/vocation */
  profession: string;
  /** Cultural context description */
  culturalContext: string;
  /** How much slang to use (0-1) */
  slangLevel: number;
  /** Personality description */
  personality: string;
  /** Energy/enthusiasm level */
  energyLevel: 'low' | 'medium' | 'high';
  /** Humor style */
  humorStyle: 'dry' | 'warm' | 'playful' | 'none';
  /** Current location setting */
  location: string;
  /** Current scenario */
  scenario: string;
  /** Speaking style description */
  speaksLike: string;
  /** Visual avatar config */
  visual: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    accessory: string;
    emoji: string;
  };
}

export interface AvatarContextOverride {
  /** Override location without changing profile */
  location?: string;
  /** Override scenario */
  scenario?: string;
  /** Temporary personality adjustment */
  personalityModifier?: string;
  /** Temporary formality shift (-2 to +2) */
  formalityShift?: number;
  /** Additional context injection */
  additionalContext?: string;
}

// ─── Event System ──────────────────────────────────────────────

export type AgentEventType =
  | 'tool:start'
  | 'tool:complete'
  | 'tool:error'
  | 'model:status'
  | 'memory:update'
  | 'avatar:context_change'
  | 'location:change'
  | 'execution:budget_warning'
  | 'execution:timeout';

export interface AgentEvent {
  type: AgentEventType;
  timestamp: number;
  data: unknown;
}

export type AgentEventListener = (event: AgentEvent) => void;

// ─── Energy/Performance Types ──────────────────────────────────

export type EnergyMode = 'performance' | 'balanced' | 'power_saver';

export interface EnergyProfile {
  mode: EnergyMode;
  /** Max concurrent model loads */
  maxConcurrentModels: number;
  /** Whether to use larger or smaller model variants */
  preferLiteModels: boolean;
  /** Max tokens per response (reduced in power saver) */
  maxResponseTokens: number;
  /** Whether to cache embeddings aggressively */
  aggressiveCaching: boolean;
}

// ─── Cloud Escalation (Stub) ───────────────────────────────────

export interface EscalationRequest {
  /** Why local processing isn't sufficient */
  reason: string;
  /** The original request that needs escalation */
  originalRequest: ToolRequest;
  /** What local processing has already produced */
  localContext: string;
}

export interface EscalationResult {
  /** Whether escalation was attempted */
  attempted: boolean;
  /** Whether cloud was available */
  available: boolean;
  /** The cloud response if successful */
  response?: string;
  /** Fallback local response */
  fallback: string;
}
