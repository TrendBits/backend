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

const connectToDatabase = async () => {
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

const getDatabase = () => {
  if (!db) throw new Error("Database not connected");
  return db;
};

export { connectToDatabase, getDatabase };
