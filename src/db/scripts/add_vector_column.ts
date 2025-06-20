import { sql } from "drizzle-orm";
import { db } from "@/db/connection";

export async function addVectorColumn() {
  try {
    console.log("\nAdding vector column to content table...");

    // Add vector column
    await db.execute(sql`
      ALTER TABLE content ADD COLUMN embedding vector(1536)
    `);

    console.log("Creating HNSW index for vector similarity search...");

    // Create HNSW index for efficient vector similarity search
    await db.execute(sql`
      CREATE INDEX content_embedding_idx ON content USING hnsw (embedding vector_cosine_ops)
    `);

    // Optional: Create partial index for better performance on filtered searches
    await db.execute(sql`
      CREATE INDEX content_provider_embedding_idx ON content USING hnsw (embedding vector_cosine_ops) 
      WHERE provider IS NOT NULL
    `);

    console.log("Vector column and indexes created successfully!");
    return;
  } catch (error) {
    console.error(
      "migration-up script failed. It's likely this already exists"
    );
    return;
  }
}

export async function removeVectorColumn() {
  console.log("Removing vector column and indexes...");

  await db.execute(sql`DROP INDEX IF EXISTS content_embedding_idx`);
  await db.execute(sql`DROP INDEX IF EXISTS content_provider_embedding_idx`);
  await db.execute(sql`ALTER TABLE content DROP COLUMN IF EXISTS embedding`);

  console.log("Vector column and indexes removed!");
}
