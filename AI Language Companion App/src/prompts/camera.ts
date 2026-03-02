import type { OCRType } from '../utils/ocrClassifier';
import type { Character } from '../types/character';
import type { LocationContext } from '../types/config';
import { promptLoader } from '../agent/prompts/promptLoader';

interface CameraPromptContext {
  character: Character;
  location: LocationContext | null;
  ocrText: string;
  dialect?: string;
}

function baseContext(ctx: CameraPromptContext): string {
  const loc = ctx.location ? `${ctx.location.city}, ${ctx.location.country}` : 'this location';
  const dialect = ctx.location?.dialectInfo?.dialect ?? 'the local language';
  return promptLoader.get('systemLayers.legacyCamera.base', {
    characterName: ctx.character.name,
    location: loc,
    dialect,
  });
}

export function buildCameraPrompt(type: OCRType, ctx: CameraPromptContext): string {
  const base = baseContext(ctx);
  const text = ctx.ocrText;
  const docType = type === 'GENERAL' || !(type in (promptLoader.getRaw('documentPrompts') as Record<string, unknown>))
    ? 'GENERAL'
    : type;

  const fullTemplate = promptLoader.get(`documentPrompts.${docType}.full`, { text });
  return `${base}\n${fullTemplate}`;
}
