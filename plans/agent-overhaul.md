# NAVI Agent Overhaul — Multi-Agent Architecture + Knowledge Graph Memory

## Goal

Transform NAVI's flat, single-agent system into a **multi-agent architecture** with:

1. **Orchestrator Agent** — holds the avatar scaffold (personality, conversation, context layers); delegates to sub-agents
2. **Research Agent** — has protocols for language learning best practices (spaced repetition, comprehensible input, i+1, etc.); can fetch web info
3. **Memory Retrieval Agent** — traverses a knowledge graph of user memories to surface relevant context

To enable this, the **memory system gets overhauled from flat lists to a knowledge graph** with rich metadata on every node (terms learned, engagement signals, language/script/avatar, encounter context, inferred reason for learning).

A **context injection protocol** defines how sub-agent outputs flow into the orchestrator's avatar scaffold for better conversations.

---

## Current State (What Exists)

### Single-Agent Architecture
```
NaviAgent (monolith)
  ├── Router (keyword matching → 1 of 13 tools)
  ├── ExecutionEngine (runs tool, enforces budget)
  ├── ConversationDirector (pre/post processing)
  ├── AvatarContextController (15-layer system prompt)
  ├── MemoryManager (6 flat stores)
  └── ModelRegistry (LLM providers)
```

### Current Memory (Flat Lists)
- **EpisodicMemory**: `{ id, summary, timestamp, location?, scenario?, importance, tags[] }` — flat array, max 100
- **SemanticMemory**: `{ id, content, embedding[], metadata, timestamp }` — vector store, max 500
- **LearnerProfile**: `{ phrases: TrackedPhrase[], topics: TopicProficiency[], ... }` — flat arrays
- **ProfileMemory**: `{ nativeLanguage, targetLanguage, preferences, notes[], userMode }`
- **RelationshipStore**: Per-avatar warmth + milestones
- **WorkingMemory**: Ring buffer (32 slots, TTL-based)

### What's Wrong
1. **No graph relationships** — episodes, phrases, topics, and scenarios exist as disconnected flat lists. "Where did the user learn 'xin chao'?" requires scanning all episodes.
2. **No rich metadata on learning events** — `TrackedPhrase` knows `learnedAt` (location string) but not: what scenario, what triggered it, how engaged the user was, what script/avatar was active.
3. **No sub-agent delegation** — everything runs through one router → one tool. No agent can reason about *how* to teach or *what* to surface from memory.
4. **No research capability** — the system can't look up language learning protocols or web info to improve teaching strategy.
5. **Memory retrieval is linear scan** — no graph traversal, no associative recall.

---

## Target Architecture

### Multi-Agent System
```
┌─────────────────────────────────────────────────────────┐
│                   ORCHESTRATOR AGENT                      │
│  ┌─────────────────────────────────────────────────┐     │
│  │            Avatar Scaffold                       │     │
│  │  (personality, dialect, warmth, mode, scenario)  │     │
│  │  15-layer system prompt assembly                 │     │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
│  Responsibilities:                                        │
│  - Owns the conversation turn                             │
│  - Assembles final system prompt from all context          │
│  - Routes user intent to tools (chat, translate, etc.)     │
│  - Delegates to sub-agents when richer context needed     │
│  - Injects sub-agent results into avatar scaffold          │
│                                                           │
│  ┌──────────────┐          ┌──────────────────────┐      │
│  │ RESEARCH     │          │ MEMORY RETRIEVAL     │      │
│  │ AGENT        │          │ AGENT                │      │
│  │              │          │                      │      │
│  │ - Language   │          │ - Knowledge Graph    │      │
│  │   learning   │          │   traversal          │      │
│  │   protocols  │          │ - Associative recall │      │
│  │ - SRS best   │          │ - Context ranking    │      │
│  │   practices  │          │ - Engagement scoring │      │
│  │ - Web lookup │          │ - Cross-session      │      │
│  │   (optional) │          │   bridging           │      │
│  └──────────────┘          └──────────────────────┘      │
│                                                           │
│  Context Injection Protocol:                               │
│  sub-agent output → structured ContextPacket               │
│    → injected into orchestrator's prompt layers            │
└─────────────────────────────────────────────────────────┘
```

### Knowledge Graph Memory
```
┌──────────────────────────────────────────────────┐
│              KNOWLEDGE GRAPH                      │
│                                                   │
│  Node Types:                                      │
│  ● ConversationNode  (chat summary + metadata)    │
│  ● TermNode          (learned phrase/word)         │
│  ● TopicNode         (language topic cluster)      │
│  ● ScenarioNode      (scenario context snapshot)   │
│  ● AvatarNode        (avatar identity snapshot)    │
│  ● LocationNode      (location context snapshot)   │
│                                                   │
│  Edge Types:                                      │
│  ─ LEARNED_IN        (Term → Conversation)         │
│  ─ ENCOUNTERED_VIA   (Term → Scenario)             │
│  ─ TAUGHT_BY         (Term → Avatar)               │
│  ─ PRACTICED_IN      (Term → Conversation)         │
│  ─ ENGAGED_DURING    (User → Conversation)         │
│  ─ OCCURRED_AT       (Conversation → Location)     │
│  ─ PART_OF           (Conversation → Scenario)     │
│  ─ RELATES_TO        (Term → Term)                 │
│  ─ LEADS_TO          (Topic → Topic)               │
│  ─ STRUGGLES_WITH    (User → Term)                 │
│  ─ REASON_TO_LEARN   (Term → reason string)        │
│                                                   │
│  Metadata on every node:                           │
│  - engagementScore (0-1)                           │
│  - language + script                               │
│  - avatarId (who was teaching)                     │
│  - timestamp                                       │
│  - encounterContext (how user met this)             │
│  - inferredReason (why user needs this)             │
└──────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Knowledge Graph Types & Store

**New file: `src/agent/memory/knowledgeGraph.ts`**

Define the graph data structures and storage layer.

#### Node Types

```typescript
// Base node — all graph nodes extend this
interface GraphNode {
  id: string;
  type: NodeType;
  createdAt: number;
  updatedAt: number;
  metadata: NodeMetadata;
}

type NodeType = 'conversation' | 'term' | 'topic' | 'scenario' | 'avatar' | 'location';

interface NodeMetadata {
  engagementScore: number;     // 0-1, how engaged the user was
  language: string;            // e.g. "Nepali", "Korean"
  script: string;              // e.g. "Devanagari", "Hangul", "Latin"
  avatarId: string;            // which avatar was active
  avatarName: string;          // human-readable
  encounterContext: string;    // how the user encountered this (free text)
  inferredReason: string;      // why the user needs to learn this
}

// --- Specific node types ---

interface ConversationNode extends GraphNode {
  type: 'conversation';
  summary: string;             // compressed chat summary
  turnCount: number;           // how many exchanges
  userMessages: string[];      // key user messages (not full transcript)
  termsIntroduced: string[];   // term IDs introduced in this conversation
  topicsCovered: string[];     // topic IDs
  location: string;
  scenario: string;
  mood: 'curious' | 'frustrated' | 'confident' | 'neutral' | 'struggling';
}

interface TermNode extends GraphNode {
  type: 'term';
  phrase: string;              // the actual phrase/word
  pronunciation?: string;
  meaning?: string;
  language: string;
  script: string;
  mastery: PhraseMastery;      // new | learning | practiced | mastered
  attemptCount: number;
  struggleCount: number;
  firstSeen: number;
  lastPracticed: number;
  nextReviewAt: number;
  learnedInConversation: string;   // conversation node ID
  learnedInScenario: string;       // scenario node ID
  learnedFromAvatar: string;       // avatar node ID
  learnedAtLocation: string;       // location node ID
  encounterType: 'scenario' | 'organic' | 'requested' | 'corrected' | 'overheard';
  inferredReason: string;          // "user is at a restaurant", "user asked how to greet"
  relatedTerms: string[];          // IDs of related term nodes
}

interface TopicNode extends GraphNode {
  type: 'topic';
  name: string;                // e.g. "greetings", "ordering_food"
  proficiencyScore: number;    // 0-1
  termIds: string[];           // all terms in this topic
  lastPracticed: number;
}

interface ScenarioNode extends GraphNode {
  type: 'scenario';
  scenarioKey: string;         // e.g. "restaurant", "hospital"
  description: string;
  conversationIds: string[];   // conversations that happened in this scenario
  termIds: string[];           // terms learned during this scenario
}

interface AvatarNode extends GraphNode {
  type: 'avatar';
  avatarId: string;
  name: string;
  personality: string;
  dialect: string;
  location: string;
  termsTeught: string[];       // term IDs this avatar introduced
  conversationIds: string[];
}

interface LocationNode extends GraphNode {
  type: 'location';
  city: string;
  country: string;
  dialectKey: string;
  language: string;
  script: string;
  conversationIds: string[];
  termIds: string[];
}
```

#### Edge Types

```typescript
interface GraphEdge {
  id: string;
  type: EdgeType;
  sourceId: string;            // node ID
  targetId: string;            // node ID
  weight: number;              // 0-1 strength of connection
  metadata: Record<string, unknown>;
  createdAt: number;
}

type EdgeType =
  | 'LEARNED_IN'          // Term → Conversation
  | 'ENCOUNTERED_VIA'     // Term → Scenario
  | 'TAUGHT_BY'           // Term → Avatar
  | 'PRACTICED_IN'        // Term → Conversation
  | 'ENGAGED_DURING'      // (implicit via engagement score)
  | 'OCCURRED_AT'         // Conversation → Location
  | 'PART_OF'             // Conversation → Scenario
  | 'RELATES_TO'          // Term → Term (semantic similarity)
  | 'LEADS_TO'            // Topic → Topic (learning progression)
  | 'STRUGGLES_WITH'      // (implicit via term struggleCount)
  | 'REASON_TO_LEARN'     // Term → reason (stored on node)
  ;
```

#### KnowledgeGraphStore Class

```typescript
class KnowledgeGraphStore {
  private nodes: Map<string, GraphNode>;
  private edges: GraphEdge[];
  private adjacency: Map<string, string[]>;  // nodeId → connected edgeIds

  async load(): Promise<void>;               // IndexedDB
  async save(): Promise<void>;

  // --- Node CRUD ---
  addNode(node: GraphNode): string;
  getNode(id: string): GraphNode | undefined;
  getNodesByType(type: NodeType): GraphNode[];
  updateNode(id: string, updates: Partial<GraphNode>): void;
  removeNode(id: string): void;

  // --- Edge CRUD ---
  addEdge(edge: Omit<GraphEdge, 'id'>): string;
  getEdgesFrom(nodeId: string): GraphEdge[];
  getEdgesTo(nodeId: string): GraphEdge[];
  getEdgesBetween(sourceId: string, targetId: string): GraphEdge[];
  removeEdge(id: string): void;

  // --- Graph Traversal ---
  getNeighbors(nodeId: string, depth?: number): GraphNode[];
  getPath(fromId: string, toId: string): GraphNode[];
  getSubgraph(centerNodeId: string, radius: number): { nodes: GraphNode[], edges: GraphEdge[] };

  // --- Query Methods ---
  getTermsLearnedInScenario(scenarioId: string): TermNode[];
  getTermsLearnedFromAvatar(avatarId: string): TermNode[];
  getTermsLearnedAtLocation(locationId: string): TermNode[];
  getConversationsForTerm(termId: string): ConversationNode[];
  getRelatedTerms(termId: string): TermNode[];
  getMostEngagedConversations(limit: number): ConversationNode[];
  getStrugglingTermsWithContext(): Array<{ term: TermNode, conversations: ConversationNode[] }>;
  getTermsByEncounterType(type: TermNode['encounterType']): TermNode[];
  getReasonClusters(): Map<string, TermNode[]>;  // group terms by inferred reason

  // --- Stats ---
  getStats(): { nodeCount: number, edgeCount: number, termCount: number, conversationCount: number };

  // --- Persistence ---
  async clear(): Promise<void>;
  serialize(): { nodes: GraphNode[], edges: GraphEdge[] };
  deserialize(data: { nodes: GraphNode[], edges: GraphEdge[] }): void;
}
```

**Persistence**: IndexedDB key `navi_knowledge_graph`. Two stores: `navi_kg_nodes`, `navi_kg_edges`.

**Migration**: On first load, migrate existing `EpisodicMemory[]` → `ConversationNode[]` and `TrackedPhrase[]` → `TermNode[]`. Old stores kept as backup for 30 days.

---

### Phase 2: Memory Making Agent (Graph Writer)

**New file: `src/agent/memory/memoryMaker.ts`**

This is the agent that analyzes conversations and writes to the knowledge graph. It runs **post-conversation** (after each exchange or batch of exchanges) and produces structured graph updates.

#### What It Extracts (the 5 metadata requirements)

For every conversation turn, the Memory Maker determines:

1. **New terms learned** — Detects when user encounters a new phrase (from phrase cards, corrections, organic usage). Creates `TermNode` with full context.
2. **Engagement level** — Scores 0-1 based on: message length, question-asking, enthusiasm markers, follow-up on previous topics, time between messages. Stored as `engagementScore` on `ConversationNode`.
3. **Language, script, and avatar** — Captures which language/script was active and which avatar was teaching. Stored on every node's `metadata`.
4. **Encounter context** — How the term was encountered: was it in a scenario (restaurant ordering), organic conversation, user-requested ("how do I say..."), a correction, or overheard (guide mode ambient listening). Stored as `encounterType` on `TermNode`.
5. **Inferred reason** — Why the user needs this term. Derived from: active scenario, recent user messages, situation model (urgency/comfort/goal). E.g., "user is preparing for a restaurant visit tomorrow", "user was confused at a pharmacy". Stored as `inferredReason` on `TermNode`.

#### MemoryMaker Class

```typescript
class MemoryMaker {
  constructor(
    private graph: KnowledgeGraphStore,
    private llmProvider: ChatLLM,           // for summarization + reason inference
    private promptLoader: PromptLoader
  )

  /**
   * Process a conversation exchange and update the knowledge graph.
   * Called by ConversationDirector.postProcess() after each turn.
   */
  async processExchange(exchange: {
    userMessage: string;
    assistantResponse: string;
    detectedPhrases: DetectedPhrase[];
    detectedTopics: string[];
    toolUsed: ToolName;
    avatarId: string;
    avatarName: string;
    location: string;
    scenario: string;
    language: string;
    script: string;
    dialectKey: string;
    userMode: 'learn' | 'guide' | 'friend' | null;
    situationModel: SituationModel;
  }): Promise<GraphUpdate>;

  /**
   * Consolidate a batch of recent exchanges into a ConversationNode.
   * Called every N exchanges (e.g., 5) or on session end.
   */
  async consolidateSession(exchanges: Exchange[]): Promise<ConversationNode>;

  /**
   * Infer the engagement score from message signals.
   * Pure heuristic — no LLM call.
   */
  private scoreEngagement(exchange: Exchange): number;

  /**
   * Classify how the user encountered a term.
   * Pure heuristic — keyword matching on context.
   */
  private classifyEncounterType(
    phrase: DetectedPhrase,
    toolUsed: ToolName,
    userMessage: string
  ): TermNode['encounterType'];

  /**
   * Infer why the user needs to learn this term.
   * Uses LLM with a short prompt for non-obvious cases.
   * Falls back to heuristic (scenario name + tool used) for obvious ones.
   */
  private async inferReason(
    phrase: DetectedPhrase,
    scenario: string,
    userMessage: string,
    situationModel: SituationModel
  ): Promise<string>;

  /**
   * Detect user mood from message content.
   * Pure heuristic.
   */
  private detectMood(userMessage: string): ConversationNode['mood'];
}

interface GraphUpdate {
  nodesCreated: GraphNode[];
  nodesUpdated: string[];       // IDs
  edgesCreated: GraphEdge[];
  conversationNodeId: string;
}
```

#### Engagement Scoring Heuristics (no LLM)

```
Score 0-1 based on weighted signals:
  +0.2  message length > 50 chars (user is investing effort)
  +0.15 user asks a follow-up question
  +0.15 user uses a previously taught phrase
  +0.1  user responds within 10 seconds
  +0.1  user uses target language (not just native)
  +0.1  user references a previous conversation topic
  +0.1  user expresses emotion (!, lol, haha, ugh, wow)
  +0.1  user asks for more detail ("tell me more", "what else")
  -0.2  very short response ("ok", "thanks", "sure")
  -0.1  long delay (> 2 minutes, suggests distraction)
```

#### Encounter Type Classification (no LLM)

```
if toolUsed === 'generate_phrase'         → 'requested'
if toolUsed === 'camera_read'             → 'overheard'
if toolUsed === 'pronounce'               → 'requested'
if userMessage matches "how do I say"     → 'requested'
if userMessage matches "what does.*mean"  → 'overheard'
if toolUsed === 'chat' && scenario active → 'scenario'
if toolUsed === 'chat' && no scenario     → 'organic'
if assistantResponse contains "actually"  → 'corrected'
  or "not quite" or "close but"
default                                   → 'organic'
```

#### Reason Inference Strategy

For **obvious cases** (heuristic, no LLM):
- Active scenario → `"User is practicing for: {scenario}"`
- Tool = translate + location set → `"User needs to understand local speech in {location}"`
- Tool = pronounce → `"User wants to say this correctly"`
- situationModel.urgency = 'immediate' → `"User needs this urgently for an upcoming interaction"`

For **non-obvious cases** (short LLM call, <50 tokens):
```
Given:
- User said: "{userMessage}"
- Avatar taught: "{phrase}" ({meaning})
- Scenario: {scenario}
- User's situation: {urgency}, {primaryGoal}

In 1 sentence, why does this user need to learn this phrase?
```

---

### Phase 3: Memory Retrieval Agent

**New file: `src/agent/agents/memoryRetrievalAgent.ts`**

The Memory Retrieval Agent is a **sub-agent** that the Orchestrator calls when it needs contextual memory for a conversation. Instead of the current flat `buildContextForPrompt()`, the retrieval agent **traverses the knowledge graph** to find the most relevant memories.

#### When It's Called

The Orchestrator calls the Memory Retrieval Agent:
- **Before every LLM call** (lightweight query, <5ms for graph traversal)
- **On session start** (deeper query — what happened last time?)
- **When user references past** ("remember when...", "last time we...")
- **When teaching a new term** (find related terms the user already knows)
- **When entering a scenario** (what terms did user learn in similar scenarios?)

#### MemoryRetrievalAgent Class

```typescript
class MemoryRetrievalAgent {
  constructor(
    private graph: KnowledgeGraphStore,
    private promptLoader: PromptLoader
  )

  /**
   * Main entry: retrieve relevant context for the current turn.
   * Returns a ContextPacket the Orchestrator injects into the avatar scaffold.
   */
  async retrieve(query: MemoryQuery): Promise<ContextPacket>;

  /**
   * Retrieve terms related to the current conversation topic.
   * Graph traversal: current topic → related terms → practice history.
   */
  async getRelatedTerms(currentTopics: string[], language: string): Promise<TermContext[]>;

  /**
   * Find conversations where user was most engaged.
   * Used to understand what teaching approaches work.
   */
  async getEngagementPatterns(avatarId: string): Promise<EngagementPattern[]>;

  /**
   * Cross-location bridging: find terms learned elsewhere
   * that are relevant to the current location.
   */
  async bridgeLocations(currentLocation: string, language: string): Promise<BridgeContext[]>;

  /**
   * Get full learning history for a specific term.
   * Traverses: Term → learned_in → Conversation → occurred_at → Location
   */
  async getTermHistory(termId: string): Promise<TermHistory>;

  /**
   * Find terms the user struggles with and their context.
   * Used by Research Agent to adjust teaching strategy.
   */
  async getStruggleContext(): Promise<StruggleContext[]>;

  /**
   * Session recap: what happened in the last session?
   */
  async getSessionRecap(avatarId: string): Promise<SessionRecap>;
}

// --- Output Types ---

interface MemoryQuery {
  userMessage: string;
  currentTopics: string[];
  currentScenario: string;
  currentLocation: string;
  currentAvatarId: string;
  language: string;
  queryType: 'turn_context' | 'session_start' | 'explicit_recall' | 'teaching' | 'scenario_entry';
}

interface ContextPacket {
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

interface TermContext {
  phrase: string;
  mastery: PhraseMastery;
  lastPracticed: number;
  encounterType: string;
  reason: string;
  relatedTerms: string[];     // phrase strings, not IDs
}

interface EngagementPattern {
  highEngagementTopics: string[];
  preferredEncounterType: string;   // which encounter type gets best engagement
  averageSessionLength: number;
  peakEngagementScenarios: string[];
}

interface TermHistory {
  term: TermNode;
  conversations: ConversationNode[];
  relatedTerms: TermNode[];
  scenarioContext: ScenarioNode | null;
  locationContext: LocationNode | null;
}

interface StruggleContext {
  term: TermNode;
  attemptCount: number;
  lastEncounterContext: string;
  suggestedApproach: string;    // derived from encounter patterns
}

interface SessionRecap {
  lastSessionSummary: string;
  termsIntroduced: TermNode[];
  termsReviewed: TermNode[];
  unfinishedTopics: string[];
  daysAgo: number;
}
```

#### Graph Traversal Strategy

For a typical `turn_context` query:

```
1. Start from current topic nodes
   → Follow LEADS_TO edges to find prerequisite/related topics
   → Collect term nodes in those topics

2. Filter terms by:
   - Same language as current
   - mastery != 'mastered' (still needs practice)
   - nextReviewAt <= now (due for review)

3. For each relevant term, traverse:
   Term → LEARNED_IN → Conversation → metadata.engagementScore
   to rank by how well the user responded when they first learned it

4. Score and rank all candidates
   - Weight: relevance to current topic × engagement history × time since last practice

5. Format top-N results into ContextPacket.promptInjection
```

---

### Phase 4: Research Agent

**New file: `src/agent/agents/researchAgent.ts`**

The Research Agent holds **built-in protocols for language learning** and can optionally fetch web resources. It advises the Orchestrator on *how* to teach, not *what* to say.

#### Built-In Protocols (JSON config)

**New file: `src/config/prompts/learningProtocols.json`**

```json
{
  "protocols": {
    "comprehensible_input": {
      "name": "Comprehensible Input (Krashen's i+1)",
      "description": "Present language slightly above the learner's current level",
      "when": "User is in learn mode and has assessed comfort tier",
      "instruction": "Introduce ONE new element per exchange. If user is tier {{tier}}, use mostly tier-{{tier}} language with ONE tier-{{nextTier}} element. Never jump 2+ tiers.",
      "source": "Krashen, S. (1982). Principles and Practice in Second Language Acquisition"
    },
    "spaced_repetition": {
      "name": "Spaced Repetition (Leitner System)",
      "description": "Review items at expanding intervals based on recall success",
      "when": "Terms are due for review (nextReviewAt <= now)",
      "instruction": "Weave the phrase '{{phrase}}' naturally into conversation. If user recognizes it, extend interval. If they struggle, shorten interval and provide context from when they first learned it: {{encounterContext}}.",
      "source": "Leitner, S. (1972). So lernt man lernen"
    },
    "contextual_learning": {
      "name": "Contextual Learning",
      "description": "Anchor new vocabulary to real situations the learner faces",
      "when": "Teaching new terms, especially in scenarios",
      "instruction": "Connect '{{phrase}}' to the user's actual situation: {{inferredReason}}. Use their specific context, not generic examples. Reference their location ({{location}}) and scenario ({{scenario}}).",
      "source": "Nation, I.S.P. (2001). Learning Vocabulary in Another Language"
    },
    "output_hypothesis": {
      "name": "Output Hypothesis (Pushed Output)",
      "description": "Learners need to produce language, not just understand it",
      "when": "User has been passively receiving for 3+ exchanges",
      "instruction": "Create a natural opening for the user to USE a phrase they've learned. Don't ask 'can you say X?' — instead create a situation where they'd naturally want to say it.",
      "source": "Swain, M. (1985). Communicative competence: Some roles of comprehensible input and comprehensible output"
    },
    "error_correction": {
      "name": "Recasting (Implicit Correction)",
      "description": "Correct errors by naturally rephrasing, not by pointing out mistakes",
      "when": "User makes a language error",
      "instruction": "If user says something incorrectly, respond naturally using the CORRECT form. Do not say 'actually, it's...' or 'the correct way is...'. Just model the right usage. Only give explicit correction if the same error appears 3+ times.",
      "source": "Lyster, R. & Ranta, L. (1997). Corrective feedback and learner uptake"
    },
    "noticing_hypothesis": {
      "name": "Noticing Hypothesis",
      "description": "Learners must consciously notice language features to acquire them",
      "when": "Introducing grammar patterns or pronunciation rules",
      "instruction": "After naturally using a pattern, briefly highlight it: 'Notice how {{pattern}} works here — {{explanation}}.' Keep it to 1 sentence. Don't lecture.",
      "source": "Schmidt, R. (1990). The role of consciousness in second language learning"
    },
    "affective_filter": {
      "name": "Low Affective Filter",
      "description": "Learning is blocked by anxiety — keep emotional safety high",
      "when": "User shows frustration, confusion, or self-doubt signals",
      "instruction": "Immediately lower language complexity. Switch to more {{userNativeLanguage}}. Validate the feeling ('{{language}} IS tricky here'). Offer the simplest version of what they need. Do NOT push new content when the filter is high.",
      "source": "Krashen, S. (1982). Principles and Practice in Second Language Acquisition"
    },
    "multimodal_encoding": {
      "name": "Multimodal Encoding",
      "description": "Terms encoded through multiple modalities (visual, auditory, contextual) are retained better",
      "when": "Teaching important/difficult terms",
      "instruction": "For the phrase '{{phrase}}': provide the written form ({{script}}), pronunciation guide, a sound tip, AND a vivid situational image ('imagine you're at {{scenario}} and...'). Hit at least 3 modalities.",
      "source": "Mayer, R. (2009). Multimedia Learning"
    }
  }
}
```

#### ResearchAgent Class

```typescript
class ResearchAgent {
  constructor(
    private protocols: LearningProtocols,     // loaded from learningProtocols.json
    private graph: KnowledgeGraphStore,
    private promptLoader: PromptLoader
  )

  /**
   * Given current conversation state, recommend which learning protocol(s) to apply
   * and generate the specific instruction to inject.
   */
  getRecommendation(context: ResearchQuery): ResearchRecommendation;

  /**
   * Determine if the user is ready for the next level (i+1).
   * Based on mastery rates, engagement, and comfort tier.
   */
  assessReadiness(learnerProfile: LearnerProfile, language: string): ReadinessAssessment;

  /**
   * Analyze struggle patterns and suggest alternative approaches.
   * Uses engagement history from knowledge graph to find what works.
   */
  analyzeStrugglePatterns(
    struggleTerms: StruggleContext[],
    engagementPatterns: EngagementPattern[]
  ): TeachingAdjustment[];

  /**
   * Optional: fetch web resources for a specific language topic.
   * Used sparingly — only when protocols alone aren't enough.
   */
  async fetchWebContext?(topic: string, language: string): Promise<string | null>;
}

interface ResearchQuery {
  userMessage: string;
  currentTier: number;           // 0-4 language comfort tier
  userMode: 'learn' | 'guide' | 'friend' | null;
  recentEngagement: number;      // average engagement over last 5 turns
  termsInSession: number;        // how many new terms introduced this session
  turnsWithoutOutput: number;    // how many turns since user produced target language
  userShowingFrustration: boolean;
  struggleTerms: string[];
  activeScenario: string;
  language: string;
}

interface ResearchRecommendation {
  /** Which protocols to apply (may be multiple) */
  protocols: Array<{
    name: string;
    instruction: string;       // interpolated, ready for injection
    priority: number;          // 0-1
  }>;
  /** Single formatted string for prompt injection */
  promptInjection: string;
  /** Suggested adjustments to conversation parameters */
  adjustments: {
    temperature?: number;       // lower = more controlled
    maxNewTerms?: number;       // cap new vocabulary this turn
    targetLanguageRatio?: number; // 0-1, how much target vs native language
  };
}

interface ReadinessAssessment {
  ready: boolean;
  currentTier: number;
  suggestedTier: number;
  confidence: number;
  reasoning: string;
}

interface TeachingAdjustment {
  termPhrase: string;
  currentApproach: string;        // how we've been teaching it
  suggestedApproach: string;      // what to try instead
  basedOn: string;                // which protocol supports this
}
```

#### Protocol Selection Logic (no LLM)

```
Priority stack (evaluated top to bottom, first match wins primary):

1. userShowingFrustration=true → affective_filter (ALWAYS)
2. turnsWithoutOutput >= 3     → output_hypothesis
3. struggleTerms.length > 0    → spaced_repetition + error_correction
4. termsInSession >= 3         → (pause new terms, consolidate)
5. tier advancement possible   → comprehensible_input (i+1)
6. scenario active             → contextual_learning
7. teaching new term           → multimodal_encoding + noticing_hypothesis
8. default                     → free_conversation (no protocol injection)

Always check affective_filter first — anxiety blocks all learning.
Multiple protocols can be active simultaneously (up to 3).
```

---

### Phase 5: Orchestrator Agent Refactor

**Modified file: `src/agent/index.ts`**

The current `NaviAgent` becomes the **Orchestrator**. Key changes:

#### What Changes

1. **Sub-agent delegation** — Orchestrator calls MemoryRetrievalAgent + ResearchAgent before each LLM call
2. **Context Injection Protocol** — Sub-agent outputs flow through a `ContextPacket` → injected into avatar scaffold layers
3. **Richer pre-processing** — ConversationDirector wires through Knowledge Graph instead of flat stores
4. **Richer post-processing** — MemoryMaker writes to Knowledge Graph after each turn

#### Context Injection Protocol

```typescript
interface ContextInjectionProtocol {
  /**
   * Called before every LLM call.
   * Gathers context from sub-agents and formats for the avatar scaffold.
   */
  async buildTurnContext(turnInput: TurnInput): Promise<TurnContext>;
}

interface TurnInput {
  userMessage: string;
  history: Message[];
  avatarId: string;
  scenario: string;
  location: string;
  language: string;
  dialectKey: string;
  userMode: 'learn' | 'guide' | 'friend' | null;
}

interface TurnContext {
  /** From MemoryRetrievalAgent */
  memoryContext: ContextPacket;
  /** From ResearchAgent */
  researchContext: ResearchRecommendation;
  /** From ConversationDirector (existing) */
  directorContext: DirectorContext;
  /** Combined prompt injection (all three merged, deduplicated) */
  combinedInjection: string;
}
```

#### How It Flows Into Avatar Scaffold

The avatar scaffold (AvatarContextController) gets new layer slots:

```
Current 15 layers + new layers:

Layer 5  (MEDIUM) — Memory Context       ← NOW from MemoryRetrievalAgent.ContextPacket
Layer 5b (MEDIUM) — Learning Protocol    ← NEW: from ResearchAgent.ResearchRecommendation
Layer 10 (MEDIUM) — Learning Context     ← NOW enriched with graph traversal data
Layer 11 (MEDIUM) — Conversation Goals   ← NOW informed by Research Agent readiness assessment
```

The `combinedInjection` string is built by:
1. Take `memoryContext.promptInjection` (memory)
2. Take `researchContext.promptInjection` (protocols)
3. Take `directorContext.promptInjection` (goals)
4. Merge, deduplicate, cap at ~400 tokens total
5. Inject into avatar scaffold layers

#### Updated Message Flow

```
User message
  │
  ├─→ MemoryRetrievalAgent.retrieve({
  │     queryType: 'turn_context',
  │     userMessage, currentTopics, scenario, location, avatarId, language
  │   })
  │   → Graph traversal → ContextPacket
  │
  ├─→ ResearchAgent.getRecommendation({
  │     userMessage, currentTier, userMode, recentEngagement,
  │     termsInSession, turnsWithoutOutput, frustration, struggleTerms
  │   })
  │   → Protocol selection → ResearchRecommendation
  │
  ├─→ ConversationDirector.preProcess(message, avatarId, options)
  │   → Goals, calibration, warmth → DirectorContext
  │
  └─→ Orchestrator merges all three → TurnContext
       │
       ├─→ AvatarContextController.buildSystemPrompt(turnContext)
       │   → 15+ layer system prompt with sub-agent context injected
       │
       ├─→ Router.routeIntent(message)
       │   → Tool selection
       │
       └─→ Tool.execute(params)
            │
            └─→ LLM.chat(systemPrompt + history + userMessage)
                 │
                 └─→ Response
                      │
                      ├─→ ConversationDirector.postProcess()
                      │
                      └─→ MemoryMaker.processExchange()
                           → Knowledge Graph updated
```

---

### Phase 6: Migration & Backwards Compatibility

#### Data Migration Strategy

```
Old stores → Knowledge Graph (one-time, on first load):

1. EpisodicMemory[] → ConversationNode[]
   - summary → summary
   - location → create/link LocationNode
   - scenario → create/link ScenarioNode
   - importance → engagementScore
   - tags → metadata

2. TrackedPhrase[] → TermNode[]
   - All existing fields map directly
   - New fields (encounterType, inferredReason) set to 'organic' / 'migrated — no context'
   - learnedAt → create/link LocationNode

3. TopicProficiency[] → TopicNode[]
   - Map directly; link to migrated TermNodes by topic keyword matching

4. ProfileMemory → preserved as-is (not graph data)
5. RelationshipStore → preserved as-is (per-avatar warmth)
6. WorkingMemory → preserved as-is (session transient)
```

#### Backwards Compatibility

- `MemoryManager` keeps its existing public API (`buildContextForPrompt`, `storeEpisodeAsync`, etc.)
- Internal implementation routes through KnowledgeGraphStore
- `LearnerProfileStore` reads/writes TermNodes instead of flat `phrases[]`
- `EpisodicMemoryStore` reads/writes ConversationNodes
- All existing UI code continues to work — changes are internal to `src/agent/`

---

### Phase 7: File Changes Summary

#### New Files
| File | Purpose |
|------|---------|
| `src/agent/memory/knowledgeGraph.ts` | Knowledge Graph store (nodes, edges, traversal) |
| `src/agent/memory/memoryMaker.ts` | Post-conversation graph writer (5 metadata extractors) |
| `src/agent/agents/memoryRetrievalAgent.ts` | Sub-agent for graph traversal + context assembly |
| `src/agent/agents/researchAgent.ts` | Sub-agent for language learning protocols |
| `src/config/prompts/learningProtocols.json` | 8 evidence-based learning protocol definitions |

#### Modified Files
| File | Changes |
|------|---------|
| `src/agent/core/types.ts` | Add graph node/edge types, ContextPacket, ResearchRecommendation, MemoryQuery |
| `src/agent/index.ts` | Orchestrator refactor: instantiate sub-agents, wire context injection protocol |
| `src/agent/memory/index.ts` | MemoryManager routes through KnowledgeGraphStore; migration logic |
| `src/agent/memory/learnerProfile.ts` | Read/write TermNodes from graph instead of flat array |
| `src/agent/memory/episodicMemory.ts` | Read/write ConversationNodes from graph instead of flat array |
| `src/agent/director/conversationDirector.ts` | Wire ResearchAgent recommendations into preProcess; MemoryMaker into postProcess |
| `src/agent/avatar/contextController.ts` | Add Layer 5b (learning protocol); accept TurnContext |
| `src/agent/tools/chatTool.ts` | Receive enriched context from Orchestrator instead of building its own |
| `src/agent/tools/phraseTool.ts` | Query graph for related terms instead of flat phrase list |
| `src/config/prompts/systemLayers.json` | Add `learningProtocol` layer template |
| `src/config/prompts/memoryExtraction.json` | Update extraction prompt for richer metadata |

#### Unchanged Files (no modifications needed)
- `src/agent/core/router.ts` — routing logic unchanged
- `src/agent/core/executionEngine.ts` — execution constraints unchanged
- `src/agent/core/toolRegistry.ts` — registry pattern unchanged
- `src/agent/core/eventBus.ts` — pub/sub unchanged
- `src/agent/models/*` — all LLM providers unchanged
- `src/agent/prompts/promptLoader.ts` — loader unchanged (just loads new JSON)
- `src/agent/prompts/phraseDetector.ts` — phrase detection unchanged
- All UI components — no frontend changes in this phase

---

## Implementation Order

### Batch 1 — Foundation (no behavior changes)
1. Define all new types in `core/types.ts`
2. Build `KnowledgeGraphStore` with full CRUD + traversal
3. Write migration logic (flat stores → graph)
4. Unit test: create nodes, edges, traverse, query

### Batch 2 — Memory Maker
5. Create `learningProtocols.json` (8 protocols)
6. Build `MemoryMaker` with 5 metadata extractors
7. Wire into `ConversationDirector.postProcess()` (alongside existing post-processing)
8. Test: verify graph updates after simulated conversations

### Batch 3 — Sub-Agents
9. Build `MemoryRetrievalAgent` with graph traversal + ContextPacket output
10. Build `ResearchAgent` with protocol selection logic
11. Unit test both agents in isolation

### Batch 4 — Orchestrator Integration
12. Refactor `NaviAgent.handleMessage()` to call sub-agents before tool execution
13. Add context injection protocol (merge sub-agent outputs → TurnContext)
14. Update `AvatarContextController` with new layer slots
15. Update `chatTool` to receive enriched context
16. Integration test: full message flow with sub-agents

### Batch 5 — Backwards Compatibility + Polish
17. Update `MemoryManager` to route through graph (keep API surface)
18. Update `LearnerProfileStore` to read/write TermNodes
19. Run existing app, verify nothing breaks
20. Update `systemLayers.json` with new layer template

### Batch 6 — Documentation
21. Update `CLAUDE.md` — add new architecture section, update Known Gaps
22. Update `audit.md` — mark resolved, add new items
23. Update `agent/ARCHITECTURE.md` — new diagrams

---

## Verification Checklist

- [ ] Knowledge Graph persists to IndexedDB and survives app restart
- [ ] Migration from flat stores → graph completes without data loss
- [ ] Old `MemoryManager.buildContextForPrompt()` returns richer context (graph-backed)
- [ ] MemoryMaker correctly extracts all 5 metadata types from a conversation turn
- [ ] TermNodes have: encounterType, inferredReason, engagementScore, language, script, avatarId
- [ ] ConversationNodes have: summary, mood, termsIntroduced, engagementScore
- [ ] MemoryRetrievalAgent returns relevant context for: turn_context, session_start, teaching, scenario_entry
- [ ] Graph traversal finds related terms across locations (cross-location bridging)
- [ ] ResearchAgent selects correct protocol: frustration → affective_filter, 3+ passive turns → output_hypothesis
- [ ] Protocol instruction is interpolated with actual user data (not template variables)
- [ ] Orchestrator merges sub-agent outputs into avatar scaffold without exceeding token budget
- [ ] Full conversation flow works end-to-end: message → sub-agents → tool → response → graph update
- [ ] Existing UI (ConversationScreen, CameraOverlay, FlashcardDeck) continues to work unchanged
- [ ] No regression in response quality — protocols enhance, not interfere
- [ ] App startup time not significantly impacted by graph loading (<500ms)
- [ ] `pnpm run build` succeeds with no type errors

---

## Out of Scope (for now)
- Embedding-based semantic search on graph nodes (keep cosine search for later)
- Web search integration for Research Agent (protocols are sufficient initially)
- UI for visualizing the knowledge graph (FlashcardDeck/KnowledgeGraphScreen can be updated later)
- Real-time graph updates visible in UI (graph is backend-only for now)
- Multi-user graph support (single user only)
