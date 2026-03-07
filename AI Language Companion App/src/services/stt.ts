declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

/** Map language names to BCP-47 codes for speech recognition */
const STT_LANG_CODE_MAP: Record<string, string> = {
  Vietnamese: 'vi-VN',
  Japanese: 'ja-JP',
  French: 'fr-FR',
  Spanish: 'es-MX',
  Korean: 'ko-KR',
  English: 'en-US',
  Chinese: 'zh-CN',
  Portuguese: 'pt-BR',
  German: 'de-DE',
  Italian: 'it-IT',
  Thai: 'th-TH',
  Arabic: 'ar-SA',
  Hindi: 'hi-IN',
  Russian: 'ru-RU',
  Indonesian: 'id-ID',
  Tagalog: 'tl-PH',
  Mandarin: 'zh-CN',
  Cantonese: 'zh-HK',
};

export function isSTTSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );
}

let recognition: SpeechRecognition | null = null;

/**
 * Start recording speech.
 * @param lang - BCP-47 language code (e.g. 'vi-VN') OR language name (e.g. 'Vietnamese')
 */
export function startRecording(
  lang: string = 'en-US',
  onResult: (transcript: string) => void,
  onError?: (error: string) => void,
): void {
  if (!isSTTSupported()) {
    onError?.('Voice input is not supported in this browser. Try Chrome.');
    return;
  }

  const SpeechRecognitionAPI =
    window.SpeechRecognition ?? window.webkitSpeechRecognition;

  // Resolve language name to BCP-47 code if needed
  const langCode = STT_LANG_CODE_MAP[lang] ?? lang;

  recognition = new SpeechRecognitionAPI();
  recognition.lang = langCode;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript ?? '';
    onResult(transcript);
  };

  recognition.onerror = (event) => {
    onError?.(event.error);
  };

  recognition.start();
}

export function stopRecording(): void {
  recognition?.stop();
  recognition = null;
}

/** Get the BCP-47 language code for a language name */
export function getSTTLangCode(languageName: string): string {
  return STT_LANG_CODE_MAP[languageName] ?? 'en-US';
}
