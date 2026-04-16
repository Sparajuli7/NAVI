---
name: standing_directive_continuous_improvement
description: STANDING DIRECTIVE - Never stop iterating on NAVI's conversational AI quality. Continuous research → implement → test → improve loop. NEVER STOP UNLESS USER SAYS STOP.
type: project
---

STANDING DIRECTIVE: Continuous improvement of NAVI's conversational AI is NEVER-ENDING. Do NOT stop between batches. Do NOT pause to summarize. Do NOT wait for permission. The loop is:

1. Run experiments (batches of 5)
2. Test with REAL MODELS via Ollama (gemma4:e2b primary, qwen2.5:1.5b for small-model validation)
3. Commit results
4. Launch next batch IMMEDIATELY
5. Research new techniques in parallel
6. REPEAT FOREVER until the user explicitly says "stop"

CRITICAL: All improvements MUST target the PRODUCTION app — the actual frontend avatars users interact with. NOT test-only prompts. Every change must flow through:
- avatarTemplates.json → AvatarSelectScreen → character creation
- contextController.buildSystemPrompt() → every LLM call
- ConversationDirector.preProcess() → skill activation
- ConversationScreen → user sees the result

Test with the LIVE agent framework against Ollama, not static analysis.

Areas to continuously improve:
- Avatar personality depth and consistency
- Language teaching effectiveness across all 4 stages
- Scenario matching and role-play quality
- Memory/context usage (knowledge graph, callbacks, backstory)
- Multi-turn coherence (degrades after turn 6 — find fixes)
- Sensory grounding across all languages (scorer is English-biased)
- Session-to-session continuity
- Month 3 retention mechanics
