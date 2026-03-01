export function buildMemoryPrompt(): string {
  return `Review this conversation and extract important facts to remember about the user.
Focus on: their goals, things they struggle with, places they've been, preferences, personal details they shared.
Ignore small talk and generic exchanges.

Respond ONLY with valid JSON (no markdown):
{"entries":[{"key":"short_label","value":"fact to remember in one sentence"}]}

Maximum 5 entries. Only include genuinely useful facts.`;
}
