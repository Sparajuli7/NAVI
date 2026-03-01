import { get, set, del } from 'idb-keyval';
import type { Character, MemoryEntry, UserPreferences } from '../types/character';
import type { Message } from '../types/chat';

const KEYS = {
  conversation: 'navi_conversation',
  character:    'navi_character',
  memories:     'navi_memories',
  preferences:  'navi_preferences',
};

export async function saveConversation(messages: Message[]): Promise<void> {
  await set(KEYS.conversation, messages);
}

export async function loadConversation(): Promise<Message[]> {
  return (await get<Message[]>(KEYS.conversation)) ?? [];
}

export async function saveCharacter(character: Character): Promise<void> {
  await set(KEYS.character, character);
}

export async function loadCharacter(): Promise<Character | null> {
  return (await get<Character>(KEYS.character)) ?? null;
}

export async function saveMemories(memories: MemoryEntry[]): Promise<void> {
  await set(KEYS.memories, memories);
}

export async function loadMemories(): Promise<MemoryEntry[]> {
  return (await get<MemoryEntry[]>(KEYS.memories)) ?? [];
}

export async function savePreferences(preferences: UserPreferences): Promise<void> {
  await set(KEYS.preferences, preferences);
}

export async function loadPreferences(): Promise<UserPreferences | null> {
  return (await get<UserPreferences>(KEYS.preferences)) ?? null;
}

export async function clearAllData(): Promise<void> {
  await Promise.all(Object.values(KEYS).map((k) => del(k)));
}
