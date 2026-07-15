import { getLanguageByCode } from '../config/supportedLanguages';

const GREETING_BY_CODE: Record<string, { phrase: string; phonetic: string }> = {
  ja: { phrase: 'こんにちは', phonetic: 'kohn-NEE-chee-wah' },
  ko: { phrase: '안녕하세요', phonetic: 'ahn-nyung-ha-SEH-yo' },
  vi: { phrase: 'xin chào', phonetic: 'sin chow' },
  fr: { phrase: 'bonjour', phonetic: 'bon-ZHOOR' },
  es: { phrase: 'hola', phonetic: 'OH-lah' },
  de: { phrase: 'hallo', phonetic: 'HAH-loh' },
  it: { phrase: 'ciao', phonetic: 'CHOW' },
  pt: { phrase: 'olá', phonetic: 'oh-LAH' },
  zh: { phrase: '你好', phonetic: 'nee-HOW' },
  th: { phrase: 'สวัสดี', phonetic: 'sa-WAT-dee' },
  ne: { phrase: 'नमस्ते', phonetic: 'na-MAS-tay' },
  hi: { phrase: 'नमस्ते', phonetic: 'nuh-MAH-stay' },
  ar: { phrase: 'مرحبا', phonetic: 'mar-HA-ba' },
  ru: { phrase: 'привет', phonetic: 'pree-VYET' },
  tr: { phrase: 'merhaba', phonetic: 'mer-HA-ba' },
  id: { phrase: 'halo', phonetic: 'HAH-loh' },
  tl: { phrase: 'kumusta', phonetic: 'koo-MOOS-tah' },
  sw: { phrase: 'habari', phonetic: 'ha-BAH-ree' },
  nl: { phrase: 'hallo', phonetic: 'HAH-loh' },
  pl: { phrase: 'cześć', phonetic: 'cheshch' },
  ca: { phrase: 'bon dia', phonetic: 'bon DEE-ah' },
};

export function buildTemplateFirstMessage(options: {
  name: string;
  templateLabel: string;
  city: string;
  languageCode?: string;
  isCustom?: boolean;
  templateFirstMessage?: string;
}): string {
  const { name, templateLabel, city, languageCode, isCustom, templateFirstMessage } = options;

  if (templateFirstMessage?.trim()) {
    return templateFirstMessage.trim();
  }

  const langInfo = languageCode ? getLanguageByCode(languageCode) : null;
  const langName = langInfo?.name ?? 'the local language';
  const greeting = languageCode ? GREETING_BY_CODE[languageCode] : null;
  const roleLabel = isCustom ? 'companion' : templateLabel.toLowerCase();

  if (greeting) {
    return (
      `Hey! I'm ${name}. Start with **${greeting.phrase}** (${greeting.phonetic}) — that's hello in ${langName}. ` +
      `I'm your ${roleLabel} in ${city}. What's on your mind?`
    );
  }

  return (
    `Hey! I'm ${name}, your ${roleLabel} in ${city}. ` +
    `I'll teach you how people actually speak here — one **local phrase** at a time, mostly in your language. ` +
    `Ask me for a greeting to get started!`
  );
}
