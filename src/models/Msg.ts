import { MsgData, SenderType } from '../types';
import { executeQuery } from '../utils/database';

export class Msg {
  public id?: number;
  public conversation_id: number;
  public content?: string;
  public summary?: string;
  public sender_type: SenderType;
  public created_at?: Date;
  public updated_at?: Date;

  constructor(data: MsgData) {
    this.id = data.id;
    this.conversation_id = data.conversation_id;
    this.content = data.content;
    this.summary = data.summary;
    this.sender_type = data.sender_type;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  async save(): Promise<Msg> {
    if (this.id) {
      return this.update();
    } else {
      return this.create();
    }
  }

  private async create(): Promise<Msg> {
    const result = await executeQuery<any>(
      `INSERT INTO msgs (conversation_id, content, summary, sender_type, created_at, updated_at) 
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [this.conversation_id, this.content ?? null, this.summary ?? null, this.sender_type]
    );
    
    this.id = result.insertId;
    this.created_at = new Date();
    this.updated_at = new Date();
    
    return this;
  }

  private async update(): Promise<Msg> {
    await executeQuery(
      `UPDATE msgs SET content = ?, summary = ?, sender_type = ?, updated_at = NOW() 
       WHERE id = ?`,
      [this.content ?? null, this.summary ?? null, this.sender_type, this.id]
    );
    
    this.updated_at = new Date();
    return this;
  }

  static async create(data: Omit<MsgData, 'id' | 'created_at' | 'updated_at'>): Promise<Msg> {
    const msg = new Msg({
      ...data,
      sender_type: data.sender_type || 'user'
    });
    
    return await msg.save();
  }

  static async findById(id: number): Promise<Msg | null> {
    const result = await executeQuery<any[]>(
      'SELECT * FROM msgs WHERE id = ?',
      [id]
    );
    
    if (result.length === 0) {
      return null;
    }
    
    return new Msg(result[0]);
  }

  static async findByConversationId(conversationId: number): Promise<Msg[]> {
    const result = await executeQuery<any[]>(
      'SELECT * FROM msgs WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversationId]
    );

    return result.map(row => new Msg(row));
  }

  static async countByConversationId(conversationId: number): Promise<number> {
    const result = await executeQuery<any[]>(
      'SELECT COUNT(*) as count FROM msgs WHERE conversation_id = ?',
      [conversationId]
    );

    return result[0]?.count || 0;
  }

  static async deleteByConversationId(conversationId: number): Promise<boolean> {
    await executeQuery(
      'DELETE FROM msgs WHERE conversation_id = ?',
      [conversationId]
    );
    
    return true;
  }

  async delete(): Promise<boolean> {
    if (!this.id) {
      return false;
    }
    
    await executeQuery(
      'DELETE FROM msgs WHERE id = ?',
      [this.id]
    );
    
    return true;
  }
}