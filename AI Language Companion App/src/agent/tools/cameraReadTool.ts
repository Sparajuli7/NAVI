/**
 * NAVI Agent Framework — Camera Read Tool
 *
 * Handles image/document understanding requests.
 * Orchestrates the image understanding pipeline.
 */

import type { ToolDefinition } from '../core/toolRegistry';
import type { ChatLLM } from '../models/chatLLM';
import type { VisionProvider } from '../models/visionProvider';
import type { AvatarContextController } from '../avatar/contextController';
import type { LocationIntelligence } from '../location/locationIntelligence';
import type { MemoryManager } from '../memory';
import { analyzeImage } from '../pipelines/imageUnderstanding';

export function createCameraReadTool(
  llmProvider: ChatLLM,
  visionProvider: VisionProvider,
  avatarController: AvatarContextController,
  locationIntelligence: LocationIntelligence,
  memoryManager?: MemoryManager,
): ToolDefinition {
  return {
    name: 'camera_read',
    description: 'Read and explain text from an image (menu, sign, document, form).',
    paramSchema: {
      imageData: { type: 'string|blob', required: true, description: 'Image data (File, Blob, or data URL)' },
      onOCRProgress: { type: 'function', required: false, description: 'OCR progress callback' },
      onExplanationToken: { type: 'function', required: false, description: 'Streaming explanation callback' },
    },
    requiredModels: ['llm', 'vision'],
    costTier: 'heavy',

    async execute(params: Record<string, unknown>): Promise<unknown> {
      const imageData = params.imageData as File | Blob | string;
      const onOCRProgress = params.onOCRProgress as ((p: number) => void) | undefined;
      const onExplanationToken = params.onExplanationToken as ((t: string, f: string) => void) | undefined;

      const userNativeLanguage = memoryManager?.profile.getProfile().nativeLanguage || 'English';
      const avatarContext = avatarController.buildSystemPrompt({ userNativeLanguage });
      const language = locationIntelligence.getPrimaryLanguage();

      const result = await analyzeImage(imageData, visionProvider, llmProvider, {
        language,
        avatarContext,
        userNativeLanguage,
        onOCRProgress,
        onExplanationToken,
      });

      return result;
    },
  };
}
