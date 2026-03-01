import { create } from 'zustand';
import type { Message } from '../types/chat';
import type { ScenarioKey } from '../types/config';

interface ChatStore {
  messages: Message[];
  isGenerating: boolean;
  activeScenario: ScenarioKey | null;

  addMessage: (message: Message) => void;
  updateLastMessage: (content: string, done?: boolean) => void;
  setGenerating: (value: boolean) => void;
  setScenario: (scenario: ScenarioKey | null) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isGenerating: false,
  activeScenario: null,

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateLastMessage: (content, done = false) =>
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (!last) return state;
      messages[messages.length - 1] = {
        ...last,
        content,
        metadata: {
          ...last.metadata,
          isStreaming: !done,
        },
      };
      return { messages };
    }),

  setGenerating: (value) => set({ isGenerating: value }),

  setScenario: (scenario) => set({ activeScenario: scenario }),

  clearMessages: () => set({ messages: [] }),
}));
