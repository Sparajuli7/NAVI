declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export function isSTTSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );
}

let recognition: SpeechRecognition | null = null;

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

  recognition = new SpeechRecognitionAPI();
  recognition.lang = lang;
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
