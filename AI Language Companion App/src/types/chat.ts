export type MessageRole = 'user' | 'character' | 'system';
export type MessageType = 'text' | 'phrase_card' | 'camera_result' | 'system';

export interface PhraseCardData {
  phrase: string;
  phonetic: string;
  soundTip: string;
  meaning: string;
  tip: string;
}

export interface ParsedSegment {
  type: 'text' | 'phrase_card';
  content?: string;
  data?: PhraseCardData;
}

export interface MessageMetadata {
  segments?: ParsedSegment[];
  scenario?: string;
  cameraContext?: string;
  isStreaming?: boolean;
}

export interface PhraseHighlight {
  text: string;
  phonetic: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  type: MessageType;
  metadata?: MessageMetadata;
  timestamp: number;
  showAvatar?: boolean;
  phraseHighlight?: PhraseHighlight;
}

export interface Conversation {
  id: string;
  character_id: string;
  messages: Message[];
  created_at: number;
  updated_at: number;
}
