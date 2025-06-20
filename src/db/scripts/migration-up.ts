import { addVectorColumn } from "./add_vector_column";
import { closeConnection } from "@/db/connection";

async function runMigration() {
  try {
    console.log("Starting vector column migration...");
    await addVectorColumn();
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    // Always close the connection
    await closeConnection();
    console.log("Database connection closed.");
    process.exit(0);
  }
}

// Run the migration
runMigration();
