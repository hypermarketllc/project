import { Pool, QueryResult } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// PostgreSQL connection configuration
const pgConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'crm_db',
  user: process.env.POSTGRES_USER || 'crm_user',
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

// Create a new pool instance
const pool = new Pool(pgConfig);

// Log connection errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Define the database interface
const db = {
  /**
   * Execute a query with parameters
   * @param text - SQL query text
   * @param params - Query parameters
   * @returns Promise with query result
   */
  query: async <T = any>(text: string, params?: any[]): Promise<QueryResult<T>> => {
    const client = await pool.connect();
    try {
      return await client.query(text, params);
    } finally {
      client.release();
    }
  },

  /**
   * Get a single row from a table
   * @param table - Table name
   * @param column - Column name for the condition
   * @param value - Value to match
   * @returns Promise with the row or null
   */
  getOne: async <T = any>(table: string, column: string, value: any): Promise<T | null> => {
    const query = `SELECT * FROM ${table} WHERE ${column} = $1 LIMIT 1`;
    const result = await db.query<T>(query, [value]);
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  /**
   * Get multiple rows from a table
   * @param table - Table name
   * @param column - Column name for the condition (optional)
   * @param value - Value to match (optional)
   * @returns Promise with the rows
   */
  getMany: async <T = any>(table: string, column?: string, value?: any): Promise<T[]> => {
    let query = `SELECT * FROM ${table}`;
    let params: any[] = [];

    if (column && value !== undefined) {
      query += ` WHERE ${column} = $1`;
      params.push(value);
    }

    const result = await db.query<T>(query, params);
    return result.rows;
  },

  /**
   * Insert a row into a table
   * @param table - Table name
   * @param data - Object with column names and values
   * @returns Promise with the inserted row
   */
  insert: async <T = any>(table: string, data: Record<string, any>): Promise<T | null> => {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await db.query<T>(query, values);
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  /**
   * Update a row in a table
   * @param table - Table name
   * @param id - ID of the row to update
   * @param data - Object with column names and values
   * @returns Promise with the updated row
   */
  update: async <T = any>(table: string, id: string | number, data: Record<string, any>): Promise<T | null> => {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

    const query = `
      UPDATE ${table}
      SET ${setClause}
      WHERE id = $${values.length + 1}
      RETURNING *
    `;

    const result = await db.query<T>(query, [...values, id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  /**
   * Delete a row from a table
   * @param table - Table name
   * @param id - ID of the row to delete
   * @returns Promise with the deleted row
   */
  delete: async <T = any>(table: string, id: string | number): Promise<T | null> => {
    const query = `
      DELETE FROM ${table}
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query<T>(query, [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  /**
   * Execute a transaction
   * @param callback - Function to execute within the transaction
   * @returns Promise with the result of the callback
   */
  transaction: async <T = any>(callback: (client: any) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  /**
   * Close the database connection pool
   */
  end: async (): Promise<void> => {
    await pool.end();
  },
};

export default db;