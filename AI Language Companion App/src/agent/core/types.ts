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
  /** Inferred interaction mode: learn=immersion, guide=translate/navigate, friend=companion, null=blended */
  userMode: 'learn' | 'guide' | 'friend' | null;
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

// ─── Learner Profile Types ─────────────────────────────────────

export type PhraseMastery = 'new' | 'learning' | 'practiced' | 'mastered';

export interface PhraseAttempt {
  /** The phrase text */
  phrase: string;
  /** Language the phrase is in */
  language: string;
  /** When this attempt occurred */
  timestamp: number;
  /** What context this was learned in */
  context: string;
  /** How well the user did */
  outcome: 'learned' | 'practiced' | 'struggled';
}

export interface TrackedPhrase {
  /** The phrase text */
  phrase: string;
  /** Pronunciation guide */
  pronunciation?: string;
  /** Natural meaning */
  meaning?: string;
  /** Language */
  language: string;
  /** Current mastery level */
  mastery: PhraseMastery;
  /** Number of times encountered/practiced */
  attemptCount: number;
  /** When first encountered */
  firstSeen: number;
  /** When last practiced */
  lastPracticed: number;
  /** When next review is due (spaced repetition) */
  nextReviewAt: number;
  /** Location where this was learned */
  learnedAt?: string;
}

export interface TopicProficiency {
  /** Topic name (e.g., 'ordering food', 'greetings') */
  topic: string;
  /** Proficiency score 0-1 */
  score: number;
  /** When last practiced */
  lastPracticed: number;
  /** Number of attempts */
  attemptCount: number;
}

export interface LearnerProfile {
  /** All tracked phrases */
  phrases: TrackedPhrase[];
  /** Per-topic proficiency scores */
  topics: TopicProficiency[];
  /**
   * Language comfort tier for the target language.
   * 0=unknown (not yet assessed), 1=beginner, 2=early, 3=intermediate, 4=advanced
   */
  languageComfortTier: number;
  /** Whether comfort level has been assessed for the current avatar/location */
  comfortAssessed: boolean;
  /** Recent conversation opener summaries to prevent repetition (last 5) */
  recentOpeners: string[];
  /** Aggregate stats */
  stats: {
    totalPhrases: number;
    masteredPhrases: number;
    currentStreak: number;
    longestStreak: number;
    lastSessionDate: number;
    totalSessions: number;
  };
}

// ─── Relationship Types ────────────────────────────────────────

export interface SharedMilestone {
  /** Unique ID */
  id: string;
  /** What happened */
  description: string;
  /** When it happened */
  timestamp: number;
  /** Which avatar this is with */
  avatarId: string;
}

export interface RelationshipState {
  /** Which avatar this relationship is with */
  avatarId: string;
  /** Warmth score 0-1 */
  warmth: number;
  /** Total interaction count */
  interactionCount: number;
  /** Total session count */
  sessionCount: number;
  /** Current consecutive day streak */
  streak: number;
  /** Last interaction timestamp */
  lastInteraction: number;
  /** Shared references / inside jokes */
  sharedReferences: string[];
  /** Milestones reached together */
  milestones: SharedMilestone[];
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
  | 'execution:timeout'
  | 'learner:phrase_detected'
  | 'learner:milestone'
  | 'learner:review_due'
  | 'relationship:warmth_change'
  | 'relationship:milestone'
  | 'director:goals_set'
  | 'director:suggestion';

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

// ─── Situation Model ────────────────────────────────────────────

export type Urgency = 'immediate' | 'short_term' | 'long_term' | 'unknown';
export type ComfortLevel = 'zero' | 'basic' | 'conversational' | 'advanced' | 'unknown';
export type PrimaryGoal = 'survive' | 'belong' | 'connect' | 'reconnect' | 'unknown';

export interface SituationModel {
  /** How soon the user needs to use the language */
  urgency: Urgency;
  /** User's current comfort level with the language */
  comfortLevel: ComfortLevel;
  /** What the user is ultimately trying to achieve */
  primaryGoal: PrimaryGoal;
  /** The next real-world situation the user is about to face */
  nextSituation: string;
  /** Whether the user is already in the target country */
  inCountry: boolean | null;
  /** How much of the initial assessment is complete (0-1) */
  assessmentConfidence: number;
  /** Number of assessment signals collected */
  signalsCollected: number;
  /** Raw signal notes from conversations */
  signals: string[];
  /** Timestamp of last update */
  lastUpdated: number;
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
