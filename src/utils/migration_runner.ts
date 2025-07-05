import path from "path";
import { connectToDatabase, getDatabase } from "../configs/database";
import { readdirSync, readFileSync } from "fs";
import dotenv from "dotenv";

dotenv.config();

export const migrationRunner = async () => {
  try {
    console.log("Starting database migration...");
    
    // Connect to database first
    await connectToDatabase();
    const db = getDatabase();
    
    const migrationDir = path.join(__dirname, "../migrations");

    const files = readdirSync(migrationDir).filter((file) =>
      file.endsWith(".sql")
    );

    console.log(`Found ${files.length} migration files`);

    for (const file of files) {
      const filePath = path.join(migrationDir, file);
      const migrationQuery = readFileSync(filePath, "utf8");
      
      console.log(`Running migration: ${file}`);
      
      // Split by semicolon and execute each statement separately
      const statements = migrationQuery
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      for (const statement of statements) {
        try {
          await db.exec(statement);
          console.log(`Executed statement from ${file}`);
        } catch (error) {
          console.error(`Error executing statement from ${file}:`, error);
        }
      }
    }
    
    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration runner error:", error);
    process.exit(1);
  }
};

// Run migration when this file is executed directly from CLI
if (require.main === module) {
  migrationRunner();
}
