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

/** Prompt templates for different document types */
const DOCUMENT_PROMPTS: Record<OCRType, string> = {
  MENU: `This is a menu. Explain what each item is, recommend what's good, help with pronunciation of dish names. If there are prices, mention them.`,
  SIGN: `This is a sign or notice. Explain what it says, why it's there, and if there's anything culturally important about it.`,
  DOCUMENT: `This is a formal document. Explain what it is (contract, form, letter, etc.), what it requires, and what the user should know. Flag anything important.`,
  PAGE: `This is a page of text. Summarize what it says and explain any culturally specific references.`,
  LABEL: `This is a product label. Explain what the product is, any important information (ingredients, warnings), and how to pronounce the brand/product name.`,
  GENERAL: `Explain what this text says, provide translation, and note anything culturally relevant.`,
};

export async function analyzeImage(
  image: File | Blob | string,
  visionProvider: VisionProvider,
  llmProvider: ChatLLM,
  options?: {
    /** Language context for the explanation */
    language?: string;
    /** Avatar persona for the explanation */
    avatarContext?: string;
    /** Callback for OCR progress */
    onOCRProgress?: (progress: number) => void;
    /** Callback for streaming explanation */
    onExplanationToken?: (token: string, full: string) => void;
  },
): Promise<ImageAnalysisResult> {
  const totalStart = Date.now();

  // Step 1: OCR
  const ocrStart = Date.now();
  const ocr: OCRResult = await visionProvider.extractText(
    image,
    undefined,
    options?.onOCRProgress,
  );
  const ocrMs = Date.now() - ocrStart;

  // Step 2: Classification
  const classStart = Date.now();
  const documentType = classifyOCR(ocr.text, ocr.blockCount, ocr.avgBlockLength);
  const classificationMs = Date.now() - classStart;

  // Step 3: LLM Explanation
  const explainStart = Date.now();
  const systemPrompt = buildExplanationPrompt(
    documentType,
    options?.language,
    options?.avatarContext,
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
): string {
  const parts: string[] = [];

  if (avatarContext) {
    parts.push(avatarContext);
  } else {
    parts.push('You are a helpful local guide explaining something to a traveler.');
  }

  parts.push(DOCUMENT_PROMPTS[documentType]);

  if (language) {
    parts.push(`The text is in ${language}. Translate key parts to English.`);
  }

  parts.push('Be concise but thorough. Explain cultural context where relevant.');

  return parts.join('\n');
}
