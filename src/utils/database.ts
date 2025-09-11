import mysql from 'mysql2/promise';
import 'dotenv/config';

export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chatbot_db',
};
console.log("DB Config:", dbConfig);

export async function getConnection() {
  return await mysql.createConnection(dbConfig);
}

export async function executeQuery<T = any>(query: string, params?: any[]): Promise<T> {
  const connection = await getConnection();
  try {
    const [result] = await connection.execute(query, params);
    return result as T;
  } finally {
    await connection.end();
  }
}