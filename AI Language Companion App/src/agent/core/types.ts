/**
 * NAVI Agent Framework — Core Type Definitions
 *
 * These types define the contracts for the entire agent system.
 * Every module implements against these interfaces, making it possible
 * to swap implementations without changing consumers.
 */

// Re-export ModelStatus from the canonical location so agent consumers
// can keep importing from this file without breakage.
export type { ModelStatus } from '../../types/inference';

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
  /** Target language the user wants to learn */
  targetLanguage?: string;
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

// ─── Learning Stage Types ─────────────────────────────────────

/**
 * Learning stage progression — tracks where the user is on their journey.
 * Stage is a computed property derived from interaction count, mastered phrases,
 * comfort tier, and scenario completion. Never stored — always reflects current state.
 *
 * Stage 0: SURVIVAL   (0-50 interactions, 0-20 mastered phrases)
 * Stage 1: FUNCTIONAL (50-200 interactions, 20-60 mastered phrases)
 * Stage 2: CONVERSATIONAL (200-500 interactions, 60-150 mastered phrases)
 * Stage 3: FLUENT     (500+ interactions, 150+ mastered phrases)
 */
export type LearningStage = 'survival' | 'functional' | 'conversational' | 'fluent';

export interface LearningStageInfo {
  /** The stage key */
  stage: LearningStage;
  /** Numeric index 0-3 */
  index: number;
  /** Target language density range (e.g. [0.1, 0.2] for 10-20%) */
  targetLanguageDensity: [number, number];
  /** Scenarios available at this stage */
  availableScenarios: string[];
  /** The raw composite score used for stage detection (0-3 continuous) */
  compositeScore: number;
}

/**
 * Scenario keys grouped by learning stage availability.
 *
 * EXP-014: survival stage now allows restaurant + emergency with extra scaffolding.
 * A brand-new user who says "I'm at a restaurant right now" should get scenario help
 * even at survival stage. The survival learningStage prompt instruction already provides
 * heavy native-language scaffolding (speak primarily in userNativeLanguage with target
 * phrases EMBEDDED), so these scenarios are safe at survival.
 */
export const STAGE_SCENARIO_ACCESS: Record<LearningStage, string[]> = {
  survival: ['restaurant', 'emergency'],
  functional: ['restaurant', 'market', 'directions', 'hotel'],
  conversational: [
    'restaurant', 'market', 'directions', 'hotel',
    'social', 'government', 'transit', 'nightlife', 'hospital',
    'office', 'school', 'customs', 'pharmacy', 'emergency',
    'landlord', 'bank', 'taxi', 'temple', 'street_food', 'date',
  ],
  fluent: [
    'restaurant', 'market', 'directions', 'hotel',
    'social', 'government', 'transit', 'nightlife', 'hospital',
    'office', 'school', 'customs', 'pharmacy', 'emergency',
    'landlord', 'bank', 'taxi', 'temple', 'street_food', 'date',
  ],
};

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
  /** Number of times the user has struggled with this phrase (optional for backwards compat) */
  struggleCount?: number;
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

/** A shared reference / inside joke with timing metadata for callback scheduling (EXP-012) */
export interface SharedReference {
  /** The reference text */
  text: string;
  /** When this reference was created (interaction count at creation) */
  createdAtInteraction: number;
  /** When this reference was created (timestamp) */
  createdAt: number;
  /** How many times this reference has been called back */
  callbackCount: number;
  /** Interaction count of the last callback */
  lastCallbackAtInteraction: number;
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
  /** Shared references / inside jokes (string[] for backward compat, SharedReference[] preferred) */
  sharedReferences: (string | SharedReference)[];
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

// ─── Knowledge Graph Types ────────────────────────────────────

export type NodeType = 'conversation' | 'term' | 'topic' | 'scenario' | 'avatar' | 'location';

export type EdgeType =
  | 'LEARNED_IN'        // Term → Conversation
  | 'ENCOUNTERED_VIA'   // Term → Scenario
  | 'TAUGHT_BY'         // Term → Avatar
  | 'PRACTICED_IN'      // Term → Conversation
  | 'OCCURRED_AT'       // Conversation → Location
  | 'PART_OF'           // Conversation → Scenario
  | 'RELATES_TO'        // Term → Term
  | 'LEADS_TO'          // Topic → Topic
  | 'CONTAINS_TERM'     // Topic → Term
  ;

export type EncounterType = 'scenario' | 'organic' | 'requested' | 'corrected' | 'overheard';

export type ConversationMood = 'curious' | 'frustrated' | 'confident' | 'neutral' | 'struggling';

/** Metadata attached to every graph node */
export interface NodeMetadata {
  /** How engaged the user was (0-1) */
  engagementScore: number;
  /** Target language active at the time */
  language: string;
  /** Writing script (Devanagari, Hangul, Latin, etc.) */
  script: string;
  /** Which avatar was active */
  avatarId: string;
  /** Avatar name (human-readable) */
  avatarName: string;
  /** How the user encountered this content */
  encounterContext: string;
  /** Why the user needs this content */
  inferredReason: string;
}

/** Base interface for all graph nodes */
export interface GraphNode {
  id: string;
  type: NodeType;
  createdAt: number;
  updatedAt: number;
  metadata: NodeMetadata;
}

/** A summarized conversation segment */
export interface ConversationNode extends GraphNode {
  type: 'conversation';
  summary: string;
  turnCount: number;
  /** Key user messages (not full transcript) */
  userMessages: string[];
  /** IDs of terms introduced in this conversation */
  termsIntroduced: string[];
  /** IDs of topics covered */
  topicsCovered: string[];
  location: string;
  scenario: string;
  mood: ConversationMood;
}

/** A learned phrase/word with full learning context */
export interface TermNode extends GraphNode {
  type: 'term';
  phrase: string;
  pronunciation?: string;
  meaning?: string;
  language: string;
  script: string;
  mastery: PhraseMastery;
  attemptCount: number;
  struggleCount: number;
  firstSeen: number;
  lastPracticed: number;
  nextReviewAt: number;
  /** ID of the conversation where this was first learned */
  learnedInConversation: string;
  /** ID of the scenario node */
  learnedInScenario: string;
  /** ID of the avatar node */
  learnedFromAvatar: string;
  /** ID of the location node */
  learnedAtLocation: string;
  /** How the user encountered this term */
  encounterType: EncounterType;
  /** Why the user needs to learn this */
  inferredReason: string;
  /** IDs of semantically related term nodes */
  relatedTerms: string[];
}

/** A language topic cluster */
export interface TopicNode extends GraphNode {
  type: 'topic';
  name: string;
  proficiencyScore: number;
  /** All term IDs in this topic */
  termIds: string[];
  lastPracticed: number;
}

/** A scenario context snapshot */
export interface ScenarioNode extends GraphNode {
  type: 'scenario';
  scenarioKey: string;
  description: string;
  /** Conversations that happened in this scenario */
  conversationIds: string[];
  /** Terms learned during this scenario */
  termIds: string[];
}

/** An avatar identity snapshot */
export interface AvatarGraphNode extends GraphNode {
  type: 'avatar';
  avatarId: string;
  name: string;
  personality: string;
  dialect: string;
  location: string;
  /** Term IDs this avatar introduced */
  termsTaught: string[];
  conversationIds: string[];
}

/** A location context snapshot */
export interface LocationNode extends GraphNode {
  type: 'location';
  city: string;
  country: string;
  dialectKey: string;
  language: string;
  script: string;
  conversationIds: string[];
  termIds: string[];
}

/** An edge connecting two graph nodes */
export interface GraphEdge {
  id: string;
  type: EdgeType;
  sourceId: string;
  targetId: string;
  /** Strength of connection (0-1) */
  weight: number;
  metadata: Record<string, unknown>;
  createdAt: number;
}

// ─── Context Injection Protocol ──────────────────────────────

/** Context about a term for prompt injection */
export interface TermContext {
  phrase: string;
  mastery: PhraseMastery;
  lastPracticed: number;
  encounterType: EncounterType;
  reason: string;
  relatedTerms: string[];
}

/** Engagement patterns for teaching strategy */
export interface EngagementPattern {
  highEngagementTopics: string[];
  preferredEncounterType: EncounterType;
  averageSessionLength: number;
  peakEngagementScenarios: string[];
}

/** Full history of a term across the graph */
export interface TermHistory {
  term: TermNode;
  conversations: ConversationNode[];
  relatedTerms: TermNode[];
  scenarioContext: ScenarioNode | null;
  locationContext: LocationNode | null;
}

/** Context for terms the user struggles with */
export interface StruggleContext {
  term: TermNode;
  attemptCount: number;
  lastEncounterContext: string;
  suggestedApproach: string;
}

/** Session recap from the Memory Retrieval Agent */
export interface SessionRecap {
  lastSessionSummary: string;
  termsIntroduced: TermNode[];
  termsReviewed: TermNode[];
  unfinishedTopics: string[];
  daysAgo: number;
}

/** Output from the Memory Retrieval Agent — ready for prompt injection */
export interface ContextPacket {
  /** Formatted string ready for injection into system prompt */
  promptInjection: string;
  /** Structured data for programmatic use */
  relatedTerms: TermContext[];
  engagementHints: string[];
  bridgeMemories: string[];
  struggleTerms: string[];
  /** How confident we are in this context (0-1) */
  relevanceScore: number;
}

/** Query for the Memory Retrieval Agent */
export interface MemoryQuery {
  userMessage: string;
  currentTopics: string[];
  currentScenario: string;
  currentLocation: string;
  currentAvatarId: string;
  language: string;
  queryType: 'turn_context' | 'session_start' | 'explicit_recall' | 'teaching' | 'scenario_entry';
}

/** Output from the Research Agent */
export interface ResearchRecommendation {
  /** Which protocols to apply (may be multiple) */
  protocols: Array<{
    name: string;
    instruction: string;
    priority: number;
  }>;
  /** Single formatted string for prompt injection */
  promptInjection: string;
  /** Suggested adjustments to conversation parameters */
  adjustments: {
    temperature?: number;
    maxNewTerms?: number;
    targetLanguageRatio?: number;
  };
}

/** Readiness assessment from the Research Agent */
export interface ReadinessAssessment {
  ready: boolean;
  currentTier: number;
  suggestedTier: number;
  confidence: number;
  reasoning: string;
}

/** Combined output from all sub-agents — fed into the Orchestrator */
export interface TurnContext {
  memoryContext: ContextPacket;
  researchContext: ResearchRecommendation;
  directorContext: {
    goals: string[];
    promptInjection: string;
    learningContext: string;
    warmthInstruction: string;
    situationContext: string;
  };
  /** Combined injection from all three sources (merged, deduplicated) */
  combinedInjection: string;
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
