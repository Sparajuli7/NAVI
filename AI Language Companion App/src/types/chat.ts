export type MessageRole = 'user' | 'character' | 'system';
export type MessageType = 'text' | 'phrase_card' | 'camera_result' | 'system';

export interface PhraseCardData {
  phrase: string;
  phonetic: string;
  soundTip: string;
  meaning: string;
  tip: string;
}

export interface TextSegment {
  type: 'text';
  content: string;
}

export interface PhraseCardSegment {
  type: 'phrase_card';
  data: PhraseCardData;
}

/** A parsed chunk of an LLM response — either plain text or a structured phrase card. */
export type ParsedSegment = TextSegment | PhraseCardSegment;

export interface MessageMetadata {
  segments?: ParsedSegment[];
  scenario?: string;
  cameraContext?: string;
  isStreaming?: boolean;
  /** Marks a proactive (agent-initiated) message so it can be filtered out of LLM history. */
  isProactive?: boolean;
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
