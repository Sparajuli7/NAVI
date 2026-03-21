import { getEngine } from './modelManager';
import { INFERENCE_CONFIGS, type InferenceConfig, type LLMMessage } from '../types/inference';
import type { Character, MemoryEntry } from '../types/character';
import { type AvatarPrefs, validateAvatarPrefs } from '../utils/avatarPrefs';

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
): Promise<{ character: Character; avatarPrefs: AvatarPrefs | null }> {
  const engine = getEngine();
  if (!engine) throw new Error('Model not loaded');

  const messages: LLMMessage[] = [
    { role: 'system', content: 'You are a character generator. Respond ONLY with valid JSON. No markdown fences, no extra text, no explanation — raw JSON only.' },
    { role: 'user', content: prompt },
  ];

  const parseResult = (raw: string): { character: Character; avatarPrefs: AvatarPrefs | null } => {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const rawAvatarPrefs = parsed.avatar_prefs;
    delete parsed.avatar_prefs;
    const character = parsed as unknown as Character;
    return { character, avatarPrefs: validateAvatarPrefs(rawAvatarPrefs) };
  };

  try {
    const reply = await engine.chat.completions.create({
      messages,
      ...getGenerationConfig(config),
      stream: false,
      response_format: { type: 'json_object' },
    });
    const raw = reply.choices[0]?.message?.content ?? '';
    return parseResult(raw);
  } catch {
    const reply2 = await engine.chat.completions.create({
      messages,
      ...getGenerationConfig({ ...config, temperature: 0.3 }),
      stream: false,
      response_format: { type: 'json_object' },
    });
    const raw2 = reply2.choices[0]?.message?.content ?? '';
    return parseResult(raw2);
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
