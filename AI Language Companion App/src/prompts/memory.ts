export function buildMemoryPrompt(): string {
  return `Summarize this conversation for future memory. Focus only on:
- New phrases the user learned (list them)
- Pronunciation difficulties observed (specific sounds/tones they struggled with)
- User preferences expressed (formality, topics, goals)
- Locations or scenarios discussed
- Important personal context shared

Respond in this JSON format and nothing else:
{
  "entries": [
    {"key": "learned_phrase", "value": "[phrase] in [language] - [mastery: learning/practiced/mastered]"},
    {"key": "pronunciation_note", "value": "[specific observation]"},
    {"key": "preference", "value": "[what they prefer]"},
    {"key": "session_summary", "value": "[1 sentence: what happened this session]"}
  ]
}

Only include entries for things that were actually discussed. If nothing notable, return {"entries":[]}.`;
}
