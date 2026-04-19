/**
 * NAVI Agent Framework — Image Understanding Pipeline
 *
 * Multi-step pipeline: Image → OCR → Classification → LLM Explanation
 *
 * Steps:
 * 1. Vision provider extracts text from image (Tesseract.js)
 * 2. OCR classifier categorizes the document type (menu, sign, form, etc.)
 * 3. LLM generates a contextual explanation using the avatar's persona
 *
 * Design decision: Pipeline pattern instead of monolithic function.
 * Each step is independently testable and replaceable. The pipeline
 * can be extended (e.g., add layout analysis before OCR) without
 * changing existing steps.
 */

import type { VisionProvider, OCRResult } from '../models/visionProvider';
import type { ChatLLM } from '../models/chatLLM';
import { classifyOCR, type OCRType } from '../../utils/ocrClassifier';
import { promptLoader } from '../prompts/promptLoader';

export interface ImageAnalysisResult {
  /** Raw extracted text */
  rawText: string;
  /** Text blocks */
  blocks: string[];
  /** What type of document this is */
  documentType: OCRType;
  /** LLM-generated explanation */
  explanation: string;
  /** OCR confidence score */
  confidence: number;
  /** How long each step took */
  timing: {
    ocrMs: number;
    classificationMs: number;
    explanationMs: number;
    totalMs: number;
  };
}

/** Get document prompt from config by OCR type */
function getDocumentPrompt(type: OCRType): string {
  return promptLoader.get(`documentPrompts.${type}.short`);
}

export async function analyzeImage(
  image: File | Blob | string,
  visionProvider: VisionProvider,
  llmProvider: ChatLLM,
  options?: {
    /** Language context for the explanation */
    language?: string;
    /** Avatar persona for the explanation */
    avatarContext?: string;
    /** User's native language for translation output */
    userNativeLanguage?: string;
    /** Callback for OCR progress */
    onOCRProgress?: (progress: number) => void;
    /** Callback for streaming explanation */
    onExplanationToken?: (token: string, full: string) => void;
  },
): Promise<ImageAnalysisResult> {
  const totalStart = Date.now();

  // Step 1: OCR
  const ocr: OCRResult = await visionProvider.extractText(
    image,
    undefined,
    options?.onOCRProgress,
  );

  // Step 2: Classification
  const documentType = classifyOCR(ocr.text, ocr.blockCount, ocr.avgBlockLength);

  // Step 3: LLM Explanation
  const explainStart = Date.now();
  const systemPrompt = buildExplanationPrompt(
    documentType,
    options?.language,
    options?.avatarContext,
    options?.userNativeLanguage,
  );

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Here is the text extracted from an image:\n\n${ocr.text}\n\nExplain this to me.` },
  ];

  const explanation = await llmProvider.chat(messages, {
    temperature: 0.3,
    max_tokens: 600,
    stream: !!options?.onExplanationToken,
    onToken: options?.onExplanationToken,
  });
  const explanationMs = Date.now() - explainStart;

  return {
    rawText: ocr.text,
    blocks: ocr.blocks,
    documentType,
    explanation,
    confidence: ocr.confidence,
    timing: {
      ocrMs,
      classificationMs,
      explanationMs,
      totalMs: Date.now() - totalStart,
    },
  };
}

function buildExplanationPrompt(
  documentType: OCRType,
  language?: string,
  avatarContext?: string,
  userNativeLanguage?: string,
): string {
  const parts: string[] = [];
  const nativeLang = userNativeLanguage || 'English';

  if (avatarContext) {
    parts.push(avatarContext);
  } else {
    parts.push('You are a helpful local guide explaining something to a traveler.');
  }

  parts.push(getDocumentPrompt(documentType));

  if (language) {
    parts.push(`The text is in ${language}. Translate key parts to ${nativeLang}.`);
  }

  parts.push('Be concise but thorough. Explain cultural context where relevant.');

  return parts.join('\n');
}
