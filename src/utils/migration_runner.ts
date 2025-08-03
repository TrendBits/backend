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
    const db = await getDatabase();

    const migrationDir = path.join(__dirname, "../migrations");

    const files = readdirSync(migrationDir)
      .filter((file) => file.endsWith(".sql"))
      .sort(); // Sort to ensure consistent order

    console.log(`Found ${files.length} migration files`);

    for (const file of files) {
      const filePath = path.join(migrationDir, file);
      const migrationQuery = readFileSync(filePath, "utf8");

      console.log(`Running migration: ${file}`);

      // Split by semicolon and execute each statement separately
      const statements = migrationQuery
        .split(";")
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt.length > 0);

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        try {
          await db.exec(statement);
          console.log(`✅ Executed statement ${i + 1}/${statements.length} from ${file}`);
        } catch (error) {
          console.error(`❌ Error in ${file} statement ${i + 1}:`, error.message);
        }
      }
    }

    // Verify tables were created
    try {
      const tables = await db.sql`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `;
      console.log("Created tables:", tables.map(t => t.name));
    } catch (error) {
      console.error("Error verifying tables:", error.message);
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
