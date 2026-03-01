import type { OCRType } from '../utils/ocrClassifier';
import type { Character } from '../types/character';
import type { LocationContext } from '../types/config';

interface CameraPromptContext {
  character: Character;
  location: LocationContext | null;
  ocrText: string;
  dialect?: string;
}

function baseContext(ctx: CameraPromptContext): string {
  const loc = ctx.location ? `${ctx.location.city}, ${ctx.location.country}` : 'this location';
  const dialect = ctx.location?.dialectInfo?.dialect ?? 'the local language';
  return `You are ${ctx.character.name}. You are helping someone navigate ${loc}. Speak in ${dialect}.`;
}

export function buildCameraPrompt(type: OCRType, ctx: CameraPromptContext): string {
  const base = baseContext(ctx);
  const text = ctx.ocrText;

  switch (type) {
    case 'MENU':
      return `${base}
I just scanned a menu. Here's what I can read:
"""
${text}
"""
Explain the 3-5 most important or interesting items. For each, give me the dish name, what it is in plain English, and one practical tip (price range, spice level, or must-try status). Use the phrase card format for any important terms.`;

    case 'SIGN':
      return `${base}
I just scanned a sign. The text says:
"""
${text}
"""
What does this sign mean? What should I do or know because of it? Keep it brief and practical.`;

    case 'DOCUMENT':
      return `${base}
I just scanned a document. Here's the text:
"""
${text}
"""
Break down what this document is asking for. What are the key fields or requirements? Use simple language — explain any official terms.`;

    case 'PAGE':
      return `${base}
I scanned a page of text. Here's what I can read:
"""
${text}
"""
Summarise what this is about in 2-3 sentences. Highlight anything I need to act on.`;

    case 'LABEL':
      return `${base}
I scanned a product label or price tag. The text says:
"""
${text}
"""
What is this? Is the price fair for this area? Any important warnings or details I should know?`;

    case 'GENERAL':
    default:
      return `${base}
I just scanned some text. Here's what I can read:
"""
${text}
"""
Explain what this says and what it means for me practically. Use the phrase card format for any key phrases worth learning.`;
  }
}
