export type SenderType = 'user' | 'bot' | 'bot-reasoning' | 'system';

export interface ConversationData {
  id?: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface MsgData {
  id?: number;
  conversation_id: number;
  content?: string;
  summary?: string;
  sender_type: SenderType;
  created_at?: Date;
  updated_at?: Date;
}