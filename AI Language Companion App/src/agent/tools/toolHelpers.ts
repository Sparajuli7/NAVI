/**
 * NAVI Agent Framework — Shared tool helpers
 *
 * Small utilities used across the LLM-backed tools to remove copy-pasted
 * boilerplate (config casts, native-language resolution).
 */

import { promptLoader } from '../prompts/promptLoader';
import type { MemoryManager } from '../memory';

/** Shape of a per-tool prompt config block in toolPrompts.json. */
export interface ToolPromptConfig {
  mode_header: string;
  template: string;
  temperature: number;
  max_tokens: number;
}

/** Load a tool's prompt config (mode_header/template/temperature/max_tokens). */
export function getToolConfig(path: string): ToolPromptConfig {
  return promptLoader.getRaw(path) as ToolPromptConfig;
}

/** Resolve the user's native language from profile memory, defaulting to English. */
export function getUserNativeLanguage(memoryManager?: MemoryManager): string {
  return memoryManager?.profile.getProfile().nativeLanguage || 'English';
}
