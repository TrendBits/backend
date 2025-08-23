import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema';

let db: ReturnType<typeof drizzle> | null = null;
let pool: Pool | null = null;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = parseInt(process.env.DB_MAX_RETRY_ATTEMPTS) || 3;
const RETRY_DELAY = parseInt(process.env.DB_RETRY_DELAY) || 2_000;

const validateEnvironment = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }
};

export const connectToDatabase = async () => {
  if (db) return db;

  validateEnvironment();

  while (connectionAttempts < MAX_RETRY_ATTEMPTS) {
    try {
      connectionAttempts++;
      console.log(
        `Attempting database connection (${connectionAttempts}/${MAX_RETRY_ATTEMPTS})...`
      );

      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      // Test connection
      await pool.query('SELECT 1');
      
      db = drizzle(pool, { schema }); 
      
      console.log('Connected to PostgreSQL successfully');
      connectionAttempts = 0;
      return db;
    } catch (error) {
      console.error(
        `Database connection attempt ${connectionAttempts} failed:`,
        error.message
      );

      if (connectionAttempts >= MAX_RETRY_ATTEMPTS) {
        console.error('Max connection attempts reached. Database unavailable.');
        throw new Error(
          'Failed to connect to database after maximum retry attempts'
        );
      }

      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
  }
};

export const getDatabase = async () => {
  if (!db) {
    await connectToDatabase();
  }
  return db!;
};

export const queryWithRetry = async <T>(
  operation: () => Promise<T>,
  retries = MAX_RETRY_ATTEMPTS
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      console.warn(`Query failed, retrying... (${retries} attempts left)`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return queryWithRetry(operation, retries - 1);
    }
    throw error;
  }
};

// Graceful shutdown
export const closeDatabase = async () => {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
};
