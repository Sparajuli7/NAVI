# NAVI — Prompting & Agent Framework Guide

Quick-reference for anyone working on NAVI's prompt system, agent pipeline, or avatar behavior. Edit prompts in JSON — not TypeScript.

---

## How a Message Flows Through the System

```
User types: "How do I order coffee?"
│
├─ 1. NaviAgent.handleMessage()                    [agent/index.ts]
│     Logs input, kicks off pipeline
│
├─ 2. ConversationDirector.preProcess()             [agent/director/conversationDirector.ts]
│     Checks learner profile (phrases due for review, weak topics, streaks)
│     Selects conversation goals (e.g., "review_due_phrases")
│     Builds warmthInstruction from RelationshipStore
│     Builds learningContext from LearnerProfileStore
│     Returns: { promptInjection, warmthInstruction, learningContext, goals }
│     ⚠ NO LLM call — pure data lookup
│
├─ 3. Router.routeIntent()                          [agent/core/router.ts]
│     Keyword matching against ROUTING_RULES
│     "how do I order" → matches 'generate_phrase' tool
│     Returns: { tool, params, confidence, reason }
│     ⚠ NO LLM call — deterministic rules
│
├─ 4. ExecutionEngine.executeTool()                  [agent/core/executionEngine.ts]
│     Enforces constraints (recursion, tokens, timeout)
│     Calls the matched tool's execute() method
│
├─ 5. Tool.execute()                                [agent/tools/*.ts]
│     Builds system prompt via AvatarContextController.buildSystemPrompt()
│     Calls llmProvider.chat() with assembled messages
│     ⚡ THIS is the LLM call
│
├─ 6. AvatarContextController.buildSystemPrompt()   [agent/avatar/contextController.ts]
│     Assembles 14 layers (see below)
│     Returns: single string = the system prompt
│
├─ 7. LLM inference                                 [agent/models/llmProvider.ts or ollamaProvider.ts]
│     WebLLM (in-browser WebGPU) or Ollama (local server)
│     Both implement ChatLLM interface — tools don't know or care which
│
├─ 8. ConversationDirector.postProcess()            [agent/director/conversationDirector.ts]
│     Scans LLM response for phrase cards (regex, no LLM call)
│     Records detected phrases in LearnerProfileStore
│     Updates topic proficiency
│     Bumps warmth in RelationshipStore
│     Checks for milestones
│     ⚠ NO LLM call — regex + data writes
│
└─ 9. Response returned to UI
```

**Key insight:** Only ONE LLM call happens per user message (step 5). Everything else is deterministic data processing.

---

## The 14-Layer System Prompt

Every LLM call gets a system prompt assembled from these layers. Layers are joined with `\n\n`.

| # | Layer | Source | Purpose |
|---|---|---|---|
| 1 | Identity | `systemLayers.json` → `identity.template` | Who the avatar IS — name, personality, speaking style, energy, humor |
| 2 | User Preferences | `userPreferenceSchema.json` → `prompt_injection` | Age, gender, formality, learning focus |
| 3 | Location + Dialect | `dialectMap.json` + runtime | City, dialect specifics, generational slang |
| 4 | Scenario | `systemLayers.json` → `scenario.template` | Context-specific vocab/tone (restaurant, hospital, etc.) |
| 5 | Memory | Runtime (MemoryManager) | Episodic memories, working memory, profile facts |
| 6 | Personality Override | Runtime override | Temporary personality adjustments |
| 7 | Additional Context | Runtime override | Any extra context injected by tools |
| 8 | Warmth Instruction | `warmthLevels.json` | Relationship-tier behavior (stranger → family) |
| 9 | Learning Context | Runtime (LearnerProfileStore) | Learner stats, recent phrases, weak topics |
| 10 | Conversation Goals | `systemLayers.json` → `conversationGoals.*` | Director-injected goals (review phrases, challenge user, etc.) |
| 11 | Few-Shot Examples | `coreRules.json` → `fewShotExamples` | Example interactions showing ideal tone |
| 12 | Core Rules | `coreRules.json` → `rules` | Immutable behavior rules, phrase card format, anti-AI guardrails |
| 13 | Internal Monologue | Hardcoded in contextController | Silent chain-of-thought instruction (think but don't output) |
| 14 | Reinforcement | `coreRules.json` → `reinforcement` | Final reminder: stay in character, keep it short, no AI talk |

**Layer 14 is last on purpose** — LLMs pay most attention to the beginning and end of the system prompt.

---

## Prompt Config Files

All prompt text lives in `src/config/prompts/`. Edit JSON to change behavior — no TypeScript changes needed.

### File Map

| File | What It Controls | Key Fields |
|---|---|---|
| `coreRules.json` | Base behavior for ALL responses | `rules`, `reinforcement`, `fewShotExamples` |
| `systemLayers.json` | Layer templates + conversation goals | `identity.template`, `scenario.template`, `conversationGoals.*` |
| `warmthLevels.json` | 5-tier relationship behavior | `levels[].instruction` (stranger → family) |
| `toolPrompts.json` | Per-tool prompts + LLM settings | `chat`, `pronounce`, `culture`, `slang`, `phrase`, `translate`, `analyze` |
| `documentPrompts.json` | Camera/OCR document analysis | 6 document types (menu, sign, form, etc.) |
| `characterGen.json` | Avatar generation prompts | `freeText.system`, `template.system` |
| `memoryExtraction.json` | Memory consolidation | `system`, `template` |

### How to Edit

1. Open the JSON file
2. Change the prompt text (use `\n` for newlines)
3. Use `{{variableName}}` for dynamic values — they get interpolated at runtime
4. Rebuild (`pnpm run build`) or hot-reload in dev

### Example: Making the avatar more casual

Edit `coreRules.json` → `rules`:
```json
"rules": "... Keep responses SHORT. Maximum 1-2 sentences ..."
```

### Example: Changing how phrases are taught

Edit `coreRules.json` → `rules`, find the `WHEN TEACHING PHRASES` section and modify the format.

### Example: Adding a new conversation goal

Edit `systemLayers.json` → `conversationGoals`:
```json
"my_new_goal": "Instruction text here. Use {{variables}} for dynamic content."
```
Then add logic in `conversationDirector.ts` to select this goal when appropriate.

---

## PromptLoader API

```typescript
import { promptLoader } from './prompts/promptLoader';

// Get a string with variable interpolation
promptLoader.get('toolPrompts.pronounce.template', { language: 'Korean', dialect: 'Seoul' })

// Get raw config (objects, arrays, numbers)
promptLoader.getRaw('toolPrompts.chat') // → { temperature: 0.7, max_tokens: 512 }

// Hot-swap a config at runtime (A/B testing)
promptLoader.loadConfig('toolPrompts', myExperimentalPrompts)

// Interpolate a custom template
promptLoader.interpolate('Hello {{name}}, welcome to {{city}}', { name: 'Suki', city: 'Tokyo' })
```

**Variable syntax:** `{{variableName}}` — matched via regex, unmatched variables are left as-is (won't crash).

**Dot-notation paths:** `configName.key.nestedKey` — e.g., `toolPrompts.pronounce.template`

Available config names: `coreRules`, `toolPrompts`, `documentPrompts`, `systemLayers`, `warmthLevels`, `memoryExtraction`, `characterGen`

---

## Routing: How Tools Get Selected

The router (`agent/core/router.ts`) is **keyword-based, not LLM-based**. This saves inference tokens and battery.

### Current Routing Rules

| Tool | Keywords | Priority |
|---|---|---|
| `camera_read` | scan, photo, image, camera, menu, sign, document | 10 |
| `pronounce` | pronounce, how to say, sound, speak | 9 |
| `translate` | translate, what does, mean | 8 |
| `teach_slang` | slang, gen z, informal, street talk | 8 |
| `explain_culture` | culture, custom, etiquette, rude, polite | 7 |
| `generate_phrase` | teach me, phrase, how to order, useful phrases | 7 |
| `switch_scenario` | restaurant, hospital, market, office | 6 |
| `switch_location` | change location, going to, traveling to | 6 |
| `memory_recall` | remember, recall, last time, you said | 5 |
| `chat` | *(default fallback)* | — |

**To add a new route:** Add an entry to `ROUTING_RULES` in `router.ts` with keywords and priority.

**Routing score:** `(keywordHits / totalKeywords) * priority`. Highest score wins. If nothing matches, falls back to `chat`.

---

## Tools: The 13 Registered Tools

Each tool is a `ToolDefinition` with `name`, `description`, `paramSchema`, `costTier`, and an `execute()` method.

| Tool | File | What It Does |
|---|---|---|
| `chat` | `chatTool.ts` | General conversation (default) |
| `translate` | `translateTool.ts` | Translation with JSON output |
| `pronounce` | `pronounceTool.ts` | Pronunciation with phrase cards |
| `camera_read` | `cameraTool.ts` | OCR → classify → explain |
| `explain_culture` | `cultureTool.ts` | Cultural context and etiquette |
| `teach_slang` | `slangTool.ts` | Generational slang teaching |
| `generate_phrase` | `phraseTool.ts` | Useful phrases for current situation |
| `memory_recall` | `memoryTool.ts` | Recall from episodic/semantic memory |
| `memory_store` | `memoryTool.ts` | Store a new memory |
| `switch_scenario` | `scenarioTool.ts` | Change conversation scenario |
| `switch_location` | `locationTool.ts` | Change user location |
| `tts_speak` | `ttsTool.ts` | Text-to-speech playback |
| `stt_listen` | `sttTool.ts` | Speech-to-text recording |

### Adding a New Tool

1. Create `src/agent/tools/myTool.ts`:

```typescript
import type { ToolDefinition } from '../core/toolRegistry';
import type { ChatLLM } from '../models/chatLLM';
import type { AvatarContextController } from '../avatar/contextController';
import type { MemoryManager } from '../memory';
import { promptLoader } from '../prompts/promptLoader';

export function createMyTool(
  llmProvider: ChatLLM,
  avatarController: AvatarContextController,
  memoryManager: MemoryManager,
): ToolDefinition {
  return {
    name: 'my_tool',
    description: 'What this tool does',
    paramSchema: {
      message: { type: 'string', required: true, description: 'User message' },
    },
    requiredModels: ['llm'],
    costTier: 'heavy', // 'heavy' = LLM call, 'light' = no LLM, 'free' = instant

    async execute(params: Record<string, unknown>): Promise<unknown> {
      const message = params.message as string;

      // Get tool-specific prompt from config
      const toolPrompt = promptLoader.get('toolPrompts.myTool.template', { /* vars */ });

      // Build system prompt with avatar context
      const systemPrompt = avatarController.buildSystemPrompt({
        warmthInstruction: params.warmthInstruction as string | undefined,
        learningContext: params.learningContext as string | undefined,
        conversationGoals: params.conversationGoals as string | undefined,
      });

      // Call the LLM
      const response = await llmProvider.chat([
        { role: 'system', content: `${systemPrompt}\n\n${toolPrompt}` },
        { role: 'user', content: message },
      ], {
        temperature: 0.6,
        max_tokens: 500,
      });

      return { response };
    },
  };
}
```

2. Register in `src/agent/tools/index.ts`:
```typescript
import { createMyTool } from './myTool';
// In registerAllTools():
toolRegistry.register(createMyTool(deps.llmProvider, deps.avatarController, deps.memoryManager));
```

3. Add routing keywords in `src/agent/core/router.ts`:
```typescript
{ tool: 'my_tool', keywords: ['my keyword', 'another trigger'], priority: 7 },
```

4. (Optional) Add a prompt config in `toolPrompts.json`:
```json
"myTool": {
  "template": "Your tool-specific instructions here with {{variables}}.",
  "temperature": 0.6,
  "max_tokens": 500
}
```

---

## Memory System (6 Stores)

| Store | Purpose | Persistence | Capacity |
|---|---|---|---|
| Working | Current session context | None (ring buffer) | 32 slots, 10 min TTL |
| Episodic | Conversation summaries | IndexedDB | 100 episodes |
| Semantic | Vector similarity search | IndexedDB | 500 entries |
| Profile | User facts and preferences | IndexedDB | Unbounded |
| Learner | Phrase tracking + spaced repetition | IndexedDB | 500 phrases |
| Relationships | Per-avatar warmth + milestones | IndexedDB | Per avatar |

### How Memory Enters the Prompt

`MemoryManager.buildContextForPrompt()` assembles a memory context string that gets injected as Layer 5 in the system prompt. It pulls from working memory, recent episodes, and profile facts.

### Spaced Repetition (Leitner-style)

| Mastery Level | Review Interval |
|---|---|
| New | 1 day |
| Learning | 3 days |
| Practiced | 7 days |
| Mastered | 30 days |

Phrases are automatically detected in LLM responses by the `phraseDetector` (regex-based, no LLM call) and tracked in the `LearnerProfileStore`.

---

## Relationship / Warmth System

Each avatar has a warmth score (0.0 → 1.0) that changes how they talk.

| Range | Tier | Behavior |
|---|---|---|
| 0.0–0.2 | Stranger | Polite, introduces self, explains fully |
| 0.2–0.4 | Acquaintance | Uses name, references past chats |
| 0.4–0.6 | Friend | Casual, teases gently, trusts user more |
| 0.6–0.8 | Close Friend | Inside jokes, challenges user, proactive |
| 0.8–1.0 | Family | Shorthand, celebrates milestones, pushes growth |

**Growth:** +0.005/interaction, +0.02/session, +0.05/milestone
**Decay:** -0.003/inactive day (floor: 0.15 once acquaintance reached)
**~200 interactions** from stranger to family.

Edit warmth behavior in `warmthLevels.json` → `levels[].instruction`.

---

## Conversation Director

The Director (`agent/director/conversationDirector.ts`) adds learning intelligence without extra LLM calls.

### Pre-Processing (before LLM call)
- Checks learner profile for phrases due for review
- Identifies struggling phrases and weak topics
- Selects a conversation goal (from `systemLayers.json` → `conversationGoals`)
- Builds `promptInjection` string that gets added to the system prompt

### Post-Processing (after LLM response)
- Runs `phraseDetector` on response text
- Records detected phrases in learner profile
- Updates topic proficiency scores
- Bumps warmth in relationship store
- Checks for milestones (first phrase, 100 phrases, streaks)

### 7 Conversation Goals

| Goal | Triggered When | Config Key |
|---|---|---|
| `introduce_new_vocab` | Weak topics detected | `systemLayers.conversationGoals.introduce_new_vocab` |
| `revisit_struggling` | Struggling phrases found | `systemLayers.conversationGoals.revisit_struggling` |
| `review_due_phrases` | Spaced repetition items due | `systemLayers.conversationGoals.review_due_phrases` |
| `challenge_user` | High proficiency | `systemLayers.conversationGoals.challenge_user` |
| `celebrate_progress` | Milestone hit | `systemLayers.conversationGoals.celebrate_progress` |
| `bridge_locations` | Cross-location experiences | `systemLayers.conversationGoals.bridge_locations` |
| `free_conversation` | Default (no specific goal) | `systemLayers.conversationGoals.free_conversation` |

---

## Console Logging

Every stage logs with `[NAVI:tag]` prefixes. Filter in browser devtools with `NAVI`.

| Tag | What It Logs |
|---|---|
| `[NAVI]` | Top-level input/output, separator lines |
| `[NAVI:router]` | Routing decision, confidence, matched tool |
| `[NAVI:exec]` | Tool start/success/error with timing |
| `[NAVI:avatar]` | System prompt assembly (layer count, avatar name, location) |
| `[NAVI:director]` | Pre-process goals, post-process phrase detections |
| `[NAVI:memory]` | Memory context building, episode storage |
| `[NAVI] PROMPT` | Full LLM prompt (all messages with roles) |
| `[NAVI] RESPONSE` | Full LLM response text |

---

## LLM Settings Per Tool

Each tool has its own temperature and max_tokens, configured in `toolPrompts.json`:

| Tool | Temperature | Max Tokens | Why |
|---|---|---|---|
| `chat` | 0.7 | 512 | Natural conversation |
| `pronounce` | 0.4 | 500 | Accurate pronunciation |
| `culture` | 0.6 | 500 | Balanced cultural advice |
| `slang` | 0.7 | 500 | Creative slang teaching |
| `phrase` | 0.4 | 600 | Accurate phrase cards |
| `translate` | 0.3 | 400 | Deterministic translation |
| `analyze` | 0.6 | 500 | Balanced social analysis |

To change: edit `toolPrompts.json` → `[toolName].temperature` / `[toolName].max_tokens`.

---

## Context Window Management

The system uses a **sliding window of 8 conversation turns** to prevent:
- Context degradation (avatar drifting out of character)
- Token budget blowout on small models (Qwen 1.5B)

Older context is preserved via episodic memory summaries (Layer 5) rather than raw message history.

Set in two places:
- `chatTool.ts` → `history.slice(-8)` (tool-level)
- `ConversationScreen.tsx` → `.slice(-8)` (UI-level)

---

## Anti-AI Guardrails

The avatar must feel human. These rules in `coreRules.json` counteract LLM fine-tuning:

1. **Never** say "As an AI", "I'm here to help", or refer to being a bot
2. **Never** offer help unprompted ("How can I help you?")
3. **Never** output bullet points or numbered lists in conversation
4. **Never** be overly polite or eager to please
5. **Keep it short** — max 2-3 sentences for casual chat
6. **Use filler words** — "hmm", "oh", "actually", "honestly"
7. **React before responding** — "wait, really?" before giving info
8. **Have opinions** — disagree, recommend favorites, say "skip that place"
9. **Be imperfect** — say "I think..." or "don't quote me"

---

## Common Tasks

### "I want to change the avatar's personality"
Edit `systemLayers.json` → `identity.template`

### "I want to change how phrases are formatted"
Edit `coreRules.json` → `rules`, find `WHEN TEACHING PHRASES` section

### "I want to add a new scenario type"
Add entry to `config/scenarioContexts.json`, optionally add keywords in `router.ts`

### "I want to add a new language/dialect"
Add entry to `config/dialectMap.json`

### "I want the avatar to behave differently at a certain warmth level"
Edit `warmthLevels.json` → `levels[].instruction`

### "I want to change how the director selects conversation goals"
Edit `conversationDirector.ts` → `selectGoals()` method

### "I want to swap the LLM model"
```typescript
// WebLLM: change preset in NaviAgentConfig
createNaviAgent({ llmPreset: 'qwen2.5-0.5b' })

// Ollama: any model
createNaviAgent({ backend: 'ollama', ollamaModel: 'llama3.2:3b' })
```

### "I want to debug what prompts are being sent"
Open browser devtools → Console → filter by `NAVI`. Every prompt and response is logged.
