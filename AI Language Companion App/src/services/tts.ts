const LANG_CODE_MAP: Record<string, string> = {
  Vietnamese: 'vi-VN',
  Japanese:   'ja-JP',
  French:     'fr-FR',
  Spanish:    'es-MX',
  Korean:     'ko-KR',
  English:    'en-US',
};

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function getAvailableLanguages(): string[] {
  if (!isTTSSupported()) return [];
  return window.speechSynthesis.getVoices().map((v) => v.lang);
}

export function speakPhrase(text: string, languageName: string = 'English'): void {
  if (!isTTSSupported()) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANG_CODE_MAP[languageName] ?? 'en-US';
  utterance.rate = 0.4;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const match = voices.find((v) => v.lang.startsWith(utterance.lang.slice(0, 2)));
  if (match) utterance.voice = match;

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (isTTSSupported()) window.speechSynthesis.cancel();
}
