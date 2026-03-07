/**
 * NAVI Agent Framework — Pronunciation Evaluation Pipeline
 *
 * Pipeline: User speaks → STT transcription → LLM comparison → TTS model pronunciation
 *
 * Steps:
 * 1. STT captures user's spoken attempt
 * 2. LLM evaluates how close the user got to the target phrase
 * 3. LLM provides correction and tips
 * 4. TTS plays the correct pronunciation
 *
 * Design decision: LLM-based evaluation rather than phoneme comparison.
 * A proper pronunciation scorer would need a phoneme alignment model
 * (like forced alignment). That's a heavy dependency. The LLM can
 * do a reasonable job of comparing transcriptions and giving feedback.
 *
 * Known limitation: The STT transcribes what it THINKS the user said,
 * not exactly how they said it. So we're comparing text, not audio.
 * This is good enough for conversational coaching but not for
 * academic pronunciation assessment.
 *
 * TODO: Evaluate forced alignment models for Phase 3
 * TODO: Measure STT accuracy across different accents
 */

import type { ChatLLM } from '../models/chatLLM';
import type { STTProvider } from '../models/sttProvider';
import type { TTSProvider } from '../models/ttsProvider';

export interface PronunciationAttempt {
  /** The phrase the user was trying to say */
  targetPhrase: string;
  /** Target language */
  targetLanguage: string;
  /** What the STT transcribed */
  userTranscription: string;
  /** LLM's evaluation */
  feedback: PronunciationFeedback;
}

export interface PronunciationFeedback {
  /** 0-1 score of how close the user got */
  score: number;
  /** Overall assessment */
  assessment: 'excellent' | 'good' | 'needs_work' | 'try_again';
  /** Specific correction tips */
  corrections: string[];
  /** Encouragement message */
  encouragement: string;
}

/**
 * Run the full pronunciation practice flow.
 *
 * @param targetPhrase - The phrase to practice
 * @param targetLanguage - Language of the phrase
 * @param llmProvider - For evaluation
 * @param sttProvider - For recording user's attempt
 * @param ttsProvider - For playing correct pronunciation
 * @param onRecordingComplete - Called when STT finishes
 */
export async function practicePronunciation(
  targetPhrase: string,
  targetLanguage: string,
  llmProvider: ChatLLM,
  sttProvider: STTProvider,
  ttsProvider: TTSProvider,
  callbacks?: {
    onRecordingStart?: () => void;
    onTranscription?: (text: string) => void;
    onFeedback?: (feedback: PronunciationFeedback) => void;
  },
): Promise<PronunciationAttempt> {
  // Step 1: Record user's attempt via STT
  console.log(`[NAVI:pipeline] pronunciation target="${targetPhrase}" lang=${targetLanguage}`);
  callbacks?.onRecordingStart?.();
  const userTranscription = await new Promise<string>((resolve, reject) => {
    const langCode = ttsProvider.getLangCode(targetLanguage);
    sttProvider.startRecording(
      langCode,
      (transcript) => {
        callbacks?.onTranscription?.(transcript);
        resolve(transcript);
      },
      (error) => reject(new Error(error)),
    );

    // Auto-stop after 10 seconds
    setTimeout(() => {
      sttProvider.stop();
    }, 10_000);
  });

  // Step 2: LLM evaluates the attempt
  const feedback = await evaluatePronunciation(
    targetPhrase,
    userTranscription,
    targetLanguage,
    llmProvider,
  );

  console.log(`[NAVI:pipeline] pronunciation feedback score=${feedback.score} assessment=${feedback.assessment}`);
  callbacks?.onFeedback?.(feedback);

  // Step 3: Play correct pronunciation slowly for learning
  ttsProvider.speakSlow(targetPhrase, targetLanguage);

  return {
    targetPhrase,
    targetLanguage,
    userTranscription,
    feedback,
  };
}

/** LLM-based pronunciation evaluation */
async function evaluatePronunciation(
  target: string,
  userSaid: string,
  language: string,
  llm: ChatLLM,
): Promise<PronunciationFeedback> {
  const prompt = `You are a pronunciation coach for ${language}.

The student was trying to say: "${target}"
The speech recognition heard them say: "${userSaid}"

Evaluate their pronunciation. Respond with ONLY a JSON object:
{
  "score": 0.0 to 1.0,
  "assessment": "excellent" | "good" | "needs_work" | "try_again",
  "corrections": ["specific tip 1", "specific tip 2"],
  "encouragement": "short encouraging message"
}

Be encouraging but honest. Focus on the most impactful corrections.`;

  const messages = [
    { role: 'system', content: prompt },
    { role: 'user', content: `Target: "${target}"\nI said: "${userSaid}"` },
  ];

  const raw = await llm.chat(messages, {
    temperature: 0.2,
    max_tokens: 300,
  });

  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as PronunciationFeedback;
  } catch {
    // Fallback if LLM doesn't return valid JSON
    const similarity = computeStringSimilarity(target.toLowerCase(), userSaid.toLowerCase());
    return {
      score: similarity,
      assessment: similarity > 0.8 ? 'good' : similarity > 0.5 ? 'needs_work' : 'try_again',
      corrections: ['Try again slowly, focusing on each syllable.'],
      encouragement: similarity > 0.5
        ? "You're getting there! Keep practicing."
        : "That's a tough one. Let's break it down.",
    };
  }
}

/** Simple string similarity (Dice coefficient) as fallback */
function computeStringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) {
    bigramsA.add(a.slice(i, i + 2));
  }

  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    if (bigramsA.has(b.slice(i, i + 2))) intersection++;
  }

  return (2 * intersection) / (a.length - 1 + b.length - 1);
}
