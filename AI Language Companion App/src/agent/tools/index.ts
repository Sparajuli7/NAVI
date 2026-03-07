/**
 * NAVI Agent Framework — Tool Index
 *
 * Registers all tools with the tool registry.
 * Call registerAllTools() during agent initialization.
 */

import { toolRegistry } from '../core/toolRegistry';
import type { ChatLLM } from '../models/chatLLM';
import type { TTSProvider } from '../models/ttsProvider';
import type { STTProvider } from '../models/sttProvider';
import type { VisionProvider } from '../models/visionProvider';
import type { TranslationProvider } from '../models/translationProvider';
import type { AvatarContextController } from '../avatar/contextController';
import type { MemoryManager } from '../memory';
import type { LocationIntelligence } from '../location/locationIntelligence';

import { createChatTool } from './chatTool';
import { createTranslateTool } from './translateTool';
import { createCameraReadTool } from './cameraReadTool';
import { createPronounceTool } from './pronounceTool';
import { createCultureTool } from './cultureTool';
import { createSlangTool } from './slangTool';
import { createPhraseTool } from './phraseTool';
import { createMemoryRecallTool, createMemoryStoreTool } from './memoryTools';
import { createSwitchScenarioTool, createSwitchLocationTool } from './scenarioTool';
import { createTTSSpeakTool, createSTTListenTool } from './speechTools';

export interface ToolDependencies {
  llmProvider: ChatLLM;
  ttsProvider: TTSProvider;
  sttProvider: STTProvider;
  visionProvider: VisionProvider;
  translationProvider: TranslationProvider;
  avatarController: AvatarContextController;
  memoryManager: MemoryManager;
  locationIntelligence: LocationIntelligence;
}

export function registerAllTools(deps: ToolDependencies): void {
  toolRegistry.clear();

  // Core conversation
  toolRegistry.register(createChatTool(deps.llmProvider, deps.avatarController, deps.memoryManager));

  // Language tools
  toolRegistry.register(createTranslateTool(deps.llmProvider, deps.translationProvider, deps.locationIntelligence, deps.memoryManager));
  toolRegistry.register(createPronounceTool(deps.llmProvider, deps.avatarController, deps.locationIntelligence, deps.memoryManager));
  toolRegistry.register(createPhraseTool(deps.llmProvider, deps.avatarController, deps.locationIntelligence, deps.memoryManager));
  toolRegistry.register(createSlangTool(deps.llmProvider, deps.avatarController, deps.locationIntelligence, deps.memoryManager));
  toolRegistry.register(createCultureTool(deps.llmProvider, deps.avatarController, deps.locationIntelligence, deps.memoryManager));

  // Vision
  toolRegistry.register(createCameraReadTool(deps.llmProvider, deps.visionProvider, deps.avatarController, deps.locationIntelligence, deps.memoryManager));

  // Memory
  toolRegistry.register(createMemoryRecallTool(deps.memoryManager));
  toolRegistry.register(createMemoryStoreTool(deps.memoryManager));

  // Context switching
  toolRegistry.register(createSwitchScenarioTool(deps.avatarController));
  toolRegistry.register(createSwitchLocationTool(deps.avatarController, deps.locationIntelligence));

  // Speech
  toolRegistry.register(createTTSSpeakTool(deps.ttsProvider, deps.locationIntelligence));
  toolRegistry.register(createSTTListenTool(deps.sttProvider, deps.locationIntelligence));
}
