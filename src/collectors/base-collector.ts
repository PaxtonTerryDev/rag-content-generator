import {
  Provider,
  ContentType,
  NewContent,
  NewCollectionJob,
  CollectionJob,
} from "@/db/schema";
import { db } from "@/db/connection";
import { EmbeddingService } from "@/services/EmbeddingService";
import { collectionJobs, content } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export interface CollectorConfig {
  rateLimitMs: number;
  batchSize: number;
  maxRetries: number;
}

export interface CollectedItem {
  externalId: string;
  contentType: ContentType;
  title?: string;
  body: string;
  author?: string;
  createdAt?: Date;
  sourceUrl?: string;
  tags?: string[];
  score?: number;
  viewCount?: number;
  commentCount?: number;
  metadata?: Record<string, any>;
}

export abstract class BaseCollector {
  protected provider: Provider;
  protected config: CollectorConfig;
  protected embeddingService: EmbeddingService;

  constructor(provider: Provider, config: CollectorConfig) {
    this.provider = provider;
    this.config = config;
    this.embeddingService = new EmbeddingService();
  }

  abstract collect(options?: any): Promise<CollectedItem[]>;

  async startCollection(options?: any): Promise<CollectionJob> {
    console.log(`Starting collection for ${this.provider}...`);

    // Create collection job
    const [job] = await db
      .insert(collectionJobs)
      .values({
        provider: this.provider,
        status: "processing",
        configuration: options || {},
      })
      .returning();

    try {
      // Collect items
      const items = await this.collect(options);
      console.log(`Collected ${items.length} items from ${this.provider}`);

      // Process and store items
      let processed = 0;
      for (const item of items) {
        try {
          await this.processAndStore(item);
          processed++;
        } catch (error) {
          console.error(`Failed to process item ${item.externalId}:`, error);
        }
      }

      // Update job status
      await db
        .update(collectionJobs)
        .set({
          status: "completed",
          completedAt: new Date(),
          itemsCollected: items.length,
          itemsProcessed: processed,
        })
        .where(eq(collectionJobs.id, job.id));

      console.log(
        `Collection completed for ${this.provider}. Processed ${processed}/${items.length} items.`
      );

      return {
        ...job,
        status: "completed" as const,
        itemsCollected: items.length,
        itemsProcessed: processed,
      };
    } catch (error) {
      console.error(`Collection failed for ${this.provider}:`, error);

      await db
        .update(collectionJobs)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : String(error),
        })
        .where(eq(collectionJobs.id, job.id));

      throw error;
    }
  }

  protected async processAndStore(item: CollectedItem): Promise<void> {
    // Check if item already exists
    const existing = await db
      .select()
      .from(content)
      .where(
        and(
          eq(content.provider, this.provider),
          eq(content.externalId, item.externalId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(`Item ${item.externalId} already exists, skipping...`);
      return;
    }

    // Generate embedding
    const textForEmbedding = this.embeddingService.prepareTextForEmbedding(
      item.title || null,
      item.body
    );

    const { embedding } = await this.embeddingService.generateEmbedding(
      textForEmbedding
    );

    // Store in database
    const newContent: NewContent = {
      externalId: item.externalId,
      provider: this.provider,
      contentType: item.contentType,
      title: item.title || null,
      body: item.body,
      author: item.author || null,
      createdAt: item.createdAt || null,
      sourceUrl: item.sourceUrl || null,
      tags: item.tags || null,
      score: item.score || 0,
      viewCount: item.viewCount || 0,
      commentCount: item.commentCount || 0,
      metadata: item.metadata || {},
      processedAt: new Date(),
    };

    // Insert content first
    const [insertedContent] = await db
      .insert(content)
      .values(newContent)
      .returning();

    // Then update with embedding using raw SQL (since Drizzle doesn't support vector yet)
    await db.execute(sql`
        UPDATE content SET embedding = ${JSON.stringify(
          embedding
        )}::vector WHERE id = ${insertedContent.id}
      `);

    console.log(`Processed and stored item: ${item.externalId}`);
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected async rateLimitedRequest<T>(
    requestFn: () => Promise<T>
  ): Promise<T> {
    let retries = 0;

    while (retries < this.config.maxRetries) {
      try {
        const result = await requestFn();
        await this.delay(this.config.rateLimitMs);
        return result;
      } catch (error) {
        retries++;
        console.error(
          `Request failed (attempt ${retries}/${this.config.maxRetries}):`,
          error
        );

        if (retries >= this.config.maxRetries) {
          throw error;
        }

        await this.delay(this.config.rateLimitMs * retries);
      }
    }

    throw new Error("Max retries exceeded");
  }
}
