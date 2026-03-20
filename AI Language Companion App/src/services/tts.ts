/**
 * TTS Service — Legacy wrapper
 *
 * Delegates to the shared LANG_CODE_MAP and voice logic.
 * Components should prefer the agent's TTSProvider directly,
 * but this wrapper remains for components not yet wired to the agent.
 */

const LANG_CODE_MAP: Record<string, string> = {
  Vietnamese: 'vi-VN',
  Japanese:   'ja-JP',
  French:     'fr-FR',
  Spanish:    'es-MX',
  Korean:     'ko-KR',
  English:    'en-US',
  Chinese:    'zh-CN',
  Portuguese: 'pt-BR',
  German:     'de-DE',
  Italian:    'it-IT',
  Thai:       'th-TH',
  Arabic:     'ar-SA',
  Hindi:      'hi-IN',
  Nepali:     'ne-NP',
  Russian:    'ru-RU',
  Indonesian: 'id-ID',
  Tagalog:    'tl-PH',
  Mandarin:   'zh-CN',
  Cantonese:  'zh-HK',
};

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function getAvailableLanguages(): string[] {
  if (!isTTSSupported()) return [];
  return window.speechSynthesis.getVoices().map((v) => v.lang);
}

/** Pick the best available voice for a language code prefix */
function pickBestVoice(voices: SpeechSynthesisVoice[], langCode: string): SpeechSynthesisVoice | undefined {
  const prefix = langCode.slice(0, 2);
  const candidates = voices.filter((v) => v.lang.startsWith(prefix));
  if (candidates.length === 0) return undefined;
  // Prefer local/offline voices, then sort by name for consistency
  const local = candidates.filter((v) => v.localService);
  return (local.length > 0 ? local : candidates)[0];
}

export function speakPhrase(text: string, languageName: string = 'English', rate: number = 1.0): void {
  if (!isTTSSupported()) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  // ne-NP fallback: if voice unavailable, try hi-IN (Devanagari family, closest available)
  const requestedCode = LANG_CODE_MAP[languageName] ?? 'en-US';
  utterance.lang = requestedCode;
  utterance.rate = rate;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  let match = pickBestVoice(voices, utterance.lang);
  // ne-NP fallback to hi-IN if no Nepali voice available
  if (!match && requestedCode === 'ne-NP') {
    match = pickBestVoice(voices, 'hi-IN');
    if (match) utterance.lang = 'hi-IN';
  }
  if (match) utterance.voice = match;

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (isTTSSupported()) window.speechSynthesis.cancel();
}
