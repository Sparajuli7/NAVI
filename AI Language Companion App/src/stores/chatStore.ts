import { create } from 'zustand';
import type { Message } from '../types/chat';
import type { ScenarioKey, ParsedScenarioContext } from '../types/config';

interface ChatStore {
  messages: Message[];
  isGenerating: boolean;
  activeScenario: ScenarioKey | null;
  scenarioContext: ParsedScenarioContext | null;
  isScenarioActive: boolean;
  /** A message queued from outside the chat input (e.g. a camera scan) for the
   *  ConversationScreen to send through its normal handleSend pipeline. */
  pendingUserMessage: string | null;

  addMessage: (message: Message) => void;
  updateLastMessage: (content: string, done?: boolean) => void;
  setGenerating: (value: boolean) => void;
  setScenario: (scenario: ScenarioKey | null) => void;
  setScenarioContext: (ctx: ParsedScenarioContext | null) => void;
  setScenarioActive: (active: boolean) => void;
  setPendingUserMessage: (text: string | null) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isGenerating: false,
  activeScenario: null,
  scenarioContext: null,
  isScenarioActive: false,
  pendingUserMessage: null,

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

  setScenarioContext: (ctx) => set({ scenarioContext: ctx }),

  setScenarioActive: (active) => set({ isScenarioActive: active }),

  setPendingUserMessage: (text) => set({ pendingUserMessage: text }),

  clearMessages: () => set({
    messages: [],
    activeScenario: null,
    scenarioContext: null,
    isScenarioActive: false,
    pendingUserMessage: null,
  }),
}));
