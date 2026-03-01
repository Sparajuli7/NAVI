import { create } from 'zustand';
import type { Character, MemoryEntry } from '../types/character';

interface CharacterStore {
  activeCharacter: Character | null;
  memories: MemoryEntry[];

  setActiveCharacter: (character: Character | null) => void;
  addMemory: (memory: MemoryEntry) => void;
  removeMemory: (id: string) => void;
  clearMemories: () => void;
}

export const useCharacterStore = create<CharacterStore>((set) => ({
  activeCharacter: null,
  memories: [],

  setActiveCharacter: (character) => set({ activeCharacter: character }),

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
