import { create } from 'zustand';
import type { Character, MemoryEntry } from '../types/character';

interface CharacterStore {
  activeCharacter: Character | null;
  characters: Character[];
  memories: MemoryEntry[];

  setActiveCharacter: (character: Character | null) => void;
  setCharacters: (characters: Character[]) => void;
  addCharacter: (character: Character) => void;
  updateActiveCharacter: (updates: Partial<Character>) => void;
  addMemory: (memory: MemoryEntry) => void;
  removeMemory: (id: string) => void;
  clearMemories: () => void;
}

export const useCharacterStore = create<CharacterStore>((set) => ({
  activeCharacter: null,
  characters: [],
  memories: [],

  setActiveCharacter: (character) => set({ activeCharacter: character }),

  setCharacters: (characters) => set({ characters }),

  addCharacter: (character) =>
    set((state) => ({ characters: [...state.characters, character] })),

  updateActiveCharacter: (updates) =>
    set((state) => {
      if (!state.activeCharacter) return state;
      const updated = { ...state.activeCharacter, ...updates };
      return {
        activeCharacter: updated,
        characters: state.characters.map((c) => (c.id === updated.id ? updated : c)),
      };
    }),

  addMemory: (memory) =>
    set((state) => ({
      memories: [...state.memories.slice(-7), memory],
    })),

  removeMemory: (id) =>
    set((state) => ({
      memories: state.memories.filter((m) => m.id !== id),
    })),

  clearMemories: () => set({ memories: [] }),
}));
