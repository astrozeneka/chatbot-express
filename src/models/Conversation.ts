import { ConversationData } from '../types';
import { executeQuery } from '../utils/database';

export class Conversation {
  public id?: number;
  public created_at?: Date;
  public updated_at?: Date;

  constructor(data: ConversationData = {}) {
    this.id = data.id;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create(): Promise<Conversation> {
    const result = await executeQuery<any>(
      'INSERT INTO conversations (created_at, updated_at) VALUES (NOW(), NOW())'
    );
    
    return new Conversation({
      id: result.insertId,
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  static async findById(id: number): Promise<Conversation | null> {
    const result = await executeQuery<any[]>(
      'SELECT * FROM conversations WHERE id = ?',
      [id]
    );
    
    if (result.length === 0) {
      return null;
    }
    
    return new Conversation(result[0]);
  }

  static async findAll(): Promise<Conversation[]> {
    const result = await executeQuery<any[]>(
      'SELECT * FROM conversations ORDER BY created_at DESC'
    );
    
    return result.map(row => new Conversation(row));
  }

  async delete(): Promise<boolean> {
    if (!this.id) {
      return false;
    }
    
    await executeQuery(
      'DELETE FROM conversations WHERE id = ?',
      [this.id]
    );
    
    return true;
  }
}