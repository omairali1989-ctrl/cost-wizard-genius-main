import mysql from "mysql2/promise";
import crypto from "node:crypto";

export const pool = mysql.createPool({
  host: process.env["MYSQL_HOST"] || "127.0.0.1",
  port: Number(process.env["MYSQL_PORT"] || 3306),
  user: process.env["MYSQL_USER"] || "root",
  password: process.env["MYSQL_PASSWORD"] || "",
  database: process.env["MYSQL_DATABASE"] || "alisons_costcraft",
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

export function generateUuid(): string {
  return crypto.randomUUID();
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return (rows.length > 0 ? rows[0] : null) as T | null;
}
