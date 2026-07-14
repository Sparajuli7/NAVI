import { create } from 'zustand';

/**
 * avatarPresenceStore — cross-component signal for the live avatar's "speaking"
 * state. Any code path that plays TTS (phrase cards, the chat reply, camera
 * overlay) flips `speaking` so the LiveAvatar presence header can mouth along,
 * without prop-drilling a callback through every speaker button.
 *
 * `thinking` and `listening` are derived locally from chat/recording state where
 * they're already known, so they don't live here — this store only carries the
 * one signal that originates outside the presence component (TTS playback).
 */
interface AvatarPresenceStore {
  speaking: boolean;
  setSpeaking: (value: boolean) => void;
}

export const useAvatarPresenceStore = create<AvatarPresenceStore>((set) => ({
  speaking: false,
  setSpeaking: (value) => set({ speaking: value }),
}));

/** Non-hook accessor so plain modules (services/tts.ts) can flip the signal. */
export const avatarPresence = {
  setSpeaking: (value: boolean) => useAvatarPresenceStore.getState().setSpeaking(value),
};
