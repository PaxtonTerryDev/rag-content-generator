import { Router, Request, Response, NextFunction } from "express";
import { db } from "@/db/connection";
import { content } from "@/db/schema";
import { sql } from "drizzle-orm";
import { EmbeddingService } from "@/services/EmbeddingService";

const router: Router = Router();

// Vector similarity search
router.post("/similar", async (req: Request, res: Response): Promise<any> => {
  try {
    const { query, limit = 10, threshold = 0.7, provider } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    console.log(`Searching for: "${query}"`);

    // Generate embedding for the query
    const embeddingService = new EmbeddingService();
    const { embedding } = await embeddingService.generateEmbedding(query);

    // Build the SQL query for vector similarity
    let searchQuery = sql`
      SELECT 
        id,
        external_id,
        provider,
        content_type,
        title,
        body,
        author,
        score,
        view_count,
        source_url,
        created_at,
        processed_at,
        (1 - (embedding <=> ${JSON.stringify(embedding)}::vector)) as similarity
      FROM content 
      WHERE embedding IS NOT NULL
        AND (1 - (embedding <=> ${JSON.stringify(
          embedding
        )}::vector)) > ${threshold}
    `;

    // Add provider filter if specified
    if (provider) {
      searchQuery = sql`${searchQuery} AND provider = ${provider}`;
    }

    searchQuery = sql`${searchQuery}
      ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
      LIMIT ${limit}
    `;

    const results = await db.execute(searchQuery);

    console.log(`Found ${results.length} similar items`);

    res.json({
      query,
      results: results.map((row) => ({
        id: row.id,
        externalId: row.external_id,
        provider: row.provider,
        contentType: row.content_type,
        title: row.title,
        body:
          typeof row.body === "string"
            ? row.body.substring(0, 500) + (row.body.length > 500 ? "..." : "")
            : "",
        author: row.author,
        score: row.score,
        viewCount: row.view_count,
        sourceUrl: row.source_url,
        createdAt: row.created_at,
        processedAt: row.processed_at,
        similarity: parseFloat(row.similarity as string),
      })),
      metadata: {
        limit,
        threshold,
        provider: provider || "all",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error performing similarity search:", error);
    res.status(500).json({
      error: "Failed to perform similarity search",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Text search (fallback for when vector search is not available)
router.post("/text", async (req: Request, res: Response): Promise<any> => {
  try {
    const { query, limit = 10, provider } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    console.log(`Text searching for: "${query}"`);

    let searchQuery = sql`
      SELECT 
        id,
        external_id,
        provider,
        content_type,
        title,
        body,
        author,
        score,
        view_count,
        source_url,
        created_at,
        processed_at,
        ts_rank(
          to_tsvector('english', coalesce(title, '') || ' ' || body),
          plainto_tsquery('english', ${query})
        ) as rank
      FROM content 
      WHERE to_tsvector('english', coalesce(title, '') || ' ' || body) 
            @@ plainto_tsquery('english', ${query})
    `;

    if (provider) {
      searchQuery = sql`${searchQuery} AND provider = ${provider}`;
    }

    searchQuery = sql`${searchQuery}
      ORDER BY rank DESC
      LIMIT ${limit}
    `;

    const results = await db.execute(searchQuery);

    res.json({
      query,
      results: results.map((row) => ({
        id: row.id,
        externalId: row.external_id,
        provider: row.provider,
        contentType: row.content_type,
        title: row.title,
        body:
          typeof row.body === "string"
            ? row.body.substring(0, 500) + (row.body.length > 500 ? "..." : "")
            : "",
        author: row.author,
        score: row.score,
        viewCount: row.view_count,
        sourceUrl: row.source_url,
        createdAt: row.created_at,
        processedAt: row.processed_at,
        rank: parseFloat(row.rank as string),
      })),
      metadata: {
        limit,
        provider: provider || "all",
        searchType: "text",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error performing text search:", error);
    res.status(500).json({ error: "Failed to perform text search" });
  }
});

export { router as searchRouter };
