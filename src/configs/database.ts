import { Database } from "@sqlitecloud/drivers";

let db = null;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = parseInt(process.env.DB_MAX_RETRY_ATTEMPTS) || 3;
const RETRY_DELAY = parseInt(process.env.DB_RETRY_DELAY) || 2_000;

const validateEnvironment = () => {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL environment variable is required");

  if (!process.env.DATABASE_URL.startsWith("sqlitecloud://"))
    throw new Error(
      "DATABASE_URL must be a valid SQLite Cloud connection string"
    );
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

      db = new Database(process.env.DATABASE_URL);
      await db.sql`SELECT 1`;

      console.log("Connected to SQLite Cloud successfully");
      connectionAttempts = 0;
      return db;
    } catch (error) {
      console.error(
        `Database connection attempt ${connectionAttempts} failed:`,
        error.message
      );

      if (connectionAttempts >= MAX_RETRY_ATTEMPTS) {
        console.error("Max connection attempts reached. Database unavailable.");
        throw new Error(
          "Failed to connect to database after maximum retry attempts"
        );
      }

      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
  }
};

export const getDatabase = async () => {
  if (db) {
    try {
      await db.sql`SELECT 1`;
      return db;
    } catch (error) {
      console.warn("Database connection is stale, reconnecting...");
      db = null;
    }
    return connectToDatabase();
  }
};

export const queryWithRetry = async <T>(
  operation: () => Promise<T>,
  retries = MAX_RETRY_ATTEMPTS
): Promise<T> => {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await operation();
    } catch (err) {
      if (
        err?.errorCode === "ERR_CONNECTION_NOT_ESTABLISHED" ||
        err?.message?.includes("Connection unavailable")
      ) {
        console.warn(`DB operation failed. Retrying... (${attempt + 1})`);
        db = null;
        await connectToDatabase(); // reconnect ro db
        attempt++;
      } else {
        throw err;
      }
    }
  }
};
