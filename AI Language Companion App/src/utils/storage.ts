import { get, set, del } from 'idb-keyval';
import type { Character, MemoryEntry, UserPreferences } from '../types/character';
import type { Message } from '../types/chat';
import type { LocationContext } from '../types/config';

const KEYS = {
  conversation: 'navi_conversation',
  character:    'navi_character',
  memories:     'navi_memories',
  preferences:  'navi_preferences',
  location:     'navi_location',
  characters:   'navi_characters',
  userProfile:  'navi_user_profile',
};

const convKey = (charId: string) => `navi_conv_${charId}`;
const memKey  = (charId: string) => `navi_mem_${charId}`;

// ── Legacy single-character storage (kept for migration) ──────────────────────

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

// ── Per-character storage ─────────────────────────────────────────────────────

export async function saveCharacterConversation(charId: string, messages: Message[]): Promise<void> {
  await set(convKey(charId), messages);
}

export async function loadCharacterConversation(charId: string): Promise<Message[]> {
  return (await get<Message[]>(convKey(charId))) ?? [];
}

export async function saveCharacterMemories(charId: string, memories: MemoryEntry[]): Promise<void> {
  await set(memKey(charId), memories);
}

export async function loadCharacterMemories(charId: string): Promise<MemoryEntry[]> {
  return (await get<MemoryEntry[]>(memKey(charId))) ?? [];
}

// ── Characters list ───────────────────────────────────────────────────────────

export async function saveCharacters(characters: Character[]): Promise<void> {
  await set(KEYS.characters, characters);
}

export async function loadCharacters(): Promise<Character[]> {
  return (await get<Character[]>(KEYS.characters)) ?? [];
}

// ── User profile notes ────────────────────────────────────────────────────────

export async function saveUserProfile(text: string): Promise<void> {
  await set(KEYS.userProfile, text);
}

export async function loadUserProfile(): Promise<string> {
  return (await get<string>(KEYS.userProfile)) ?? '';
}

// ── Preferences / Location ────────────────────────────────────────────────────

export async function savePreferences(preferences: UserPreferences): Promise<void> {
  await set(KEYS.preferences, preferences);
}

export async function loadPreferences(): Promise<UserPreferences | null> {
  return (await get<UserPreferences>(KEYS.preferences)) ?? null;
}

export async function saveLocation(location: LocationContext): Promise<void> {
  await set(KEYS.location, location);
}

export async function loadLocation(): Promise<LocationContext | null> {
  return (await get<LocationContext>(KEYS.location)) ?? null;
}

// ── Avatar portrait images ────────────────────────────────────────────────────

const avatarImgKey = (charId: string) => `navi_avatar_img_${charId}`;

export async function saveAvatarImage(characterId: string, base64: string): Promise<void> {
  await set(avatarImgKey(characterId), base64);
}

export async function loadAvatarImage(characterId: string): Promise<string | null> {
  return (await get<string>(avatarImgKey(characterId))) ?? null;
}

// ── Per-character cleanup ─────────────────────────────────────────────────────

/** Delete all IndexedDB data for a specific character (conversation, memories, portrait). */
export async function deleteCharacterData(charId: string): Promise<void> {
  await Promise.all([
    del(convKey(charId)),
    del(memKey(charId)),
    del(avatarImgKey(charId)),
  ]);
}

// ── Nuclear reset ─────────────────────────────────────────────────────────────

export async function clearAllData(): Promise<void> {
  await Promise.all(Object.values(KEYS).map((k) => del(k)));
}
