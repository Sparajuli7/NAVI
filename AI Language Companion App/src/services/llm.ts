import { getEngine } from './modelManager';
import { INFERENCE_CONFIGS, type InferenceConfig, type LLMMessage } from '../types/inference';
import type { Character, MemoryEntry } from '../types/character';

function getGenerationConfig(config: InferenceConfig) {
  return {
    temperature: config.temperature,
    top_p: config.top_p,
    max_tokens: config.max_tokens,
    frequency_penalty: 0,
    presence_penalty: config.presence_penalty,
  };
}

export async function sendMessage(
  messages: LLMMessage[],
  config: InferenceConfig = INFERENCE_CONFIGS.chat,
): Promise<string> {
  const engine = getEngine();
  if (!engine) throw new Error('Model not loaded');

  const reply = await engine.chat.completions.create({
    messages,
    ...getGenerationConfig(config),
    stream: false,
  });

  return reply.choices[0]?.message?.content ?? '';
}

export async function streamMessage(
  messages: LLMMessage[],
  config: InferenceConfig = INFERENCE_CONFIGS.chat,
  onToken: (token: string, fullText: string) => void,
): Promise<string> {
  const engine = getEngine();
  if (!engine) throw new Error('Model not loaded');

  const stream = await engine.chat.completions.create({
    messages,
    ...getGenerationConfig(config),
    stream: true,
  });

  let fullText = '';
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    if (delta) {
      fullText += delta;
      onToken(delta, fullText);
    }
  }
  return fullText;
}

export async function generateCharacter(
  prompt: string,
  config: InferenceConfig = INFERENCE_CONFIGS.character_gen,
): Promise<Character> {
  const messages: LLMMessage[] = [
    { role: 'system', content: 'You are a character generator. Respond ONLY with valid JSON, no markdown fences.' },
    { role: 'user', content: prompt },
  ];

  let raw = await sendMessage(messages, config);
  raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(raw) as Character;
  } catch {
    raw = await sendMessage(messages, { ...config, temperature: 0.3 });
    raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(raw) as Character;
  }
}

export async function generateMemorySummary(
  recentMessages: LLMMessage[],
  config: InferenceConfig = INFERENCE_CONFIGS.memory_gen,
): Promise<MemoryEntry[]> {
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content:
        'Extract important facts from this conversation to remember. Respond ONLY with valid JSON: {"entries":[{"key":"string","value":"string"}]}. No markdown.',
    },
    ...recentMessages,
    { role: 'user', content: 'Extract memories from this conversation.' },
  ];

  let raw = await sendMessage(messages, config);
  raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const parsed = JSON.parse(raw) as { entries: Array<{ key: string; value: string }> };
    if (!Array.isArray(parsed.entries)) return [];
    return parsed.entries
      .filter(e => e.key && e.value)
      .map((e, i) => ({
        id: `${Date.now()}_${i}`,
        key: e.key,
        value: e.value,
        created_at: Date.now(),
      }));
  } catch {
    // Retry once with lower temperature before giving up
    try {
      let raw2 = await sendMessage(messages, { ...config, temperature: 0.1 });
      raw2 = raw2.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed2 = JSON.parse(raw2) as { entries: Array<{ key: string; value: string }> };
      if (!Array.isArray(parsed2.entries)) return [];
      return parsed2.entries
        .filter(e => e.key && e.value)
        .map((e, i) => ({
          id: `${Date.now()}_${i}`,
          key: e.key,
          value: e.value,
          created_at: Date.now(),
        }));
    } catch {
      return [];
    }
  }
}
