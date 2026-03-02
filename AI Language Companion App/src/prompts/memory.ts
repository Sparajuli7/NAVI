import { promptLoader } from '../agent/prompts/promptLoader';

export function buildMemoryPrompt(): string {
  return promptLoader.get('memoryExtraction.template');
}
