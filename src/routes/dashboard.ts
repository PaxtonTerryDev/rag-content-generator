import express, { Router, Request, Response, NextFunction } from "express";
import { db } from "@/db/connection";
import { content, collectionJobs } from "@/db/schema";
import { sql, desc, count } from "drizzle-orm";

const router: Router = Router();

// Get dashboard statistics
const getDashboardStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get total content count by provider
    const contentByProvider = await db
      .select({
        provider: content.provider,
        count: count(),
      })
      .from(content)
      .groupBy(content.provider);

    // Get total content count
    const [totalContent] = await db.select({ count: count() }).from(content);

    // Get recent collection jobs
    const recentJobs = await db
      .select()
      .from(collectionJobs)
      .orderBy(desc(collectionJobs.startedAt))
      .limit(5);

    // Get job statistics
    const jobStats = await db
      .select({
        status: collectionJobs.status,
        count: count(),
      })
      .from(collectionJobs)
      .groupBy(collectionJobs.status);

    // Get content by type
    const contentByType = await db
      .select({
        contentType: content.contentType,
        count: count(),
      })
      .from(content)
      .groupBy(content.contentType);

    // Get recent content
    const recentContent = await db
      .select({
        id: content.id,
        provider: content.provider,
        contentType: content.contentType,
        title: content.title,
        author: content.author,
        score: content.score,
        createdAt: content.createdAt,
        processedAt: content.processedAt,
      })
      .from(content)
      .orderBy(desc(content.processedAt))
      .limit(10);

    res.json({
      totalContent: totalContent.count,
      contentByProvider,
      contentByType,
      jobStats,
      recentJobs,
      recentContent,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ error: "Failed to fetch dashboard statistics" });
  }
};

// Get content overview with pagination
const getContentOverview = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const provider = req.query.provider as string;
    const contentType = req.query.contentType as string;

    const offset = (page - 1) * limit;

    // Build the base query with conditional filtering
    const baseQuery = db
      .select({
        id: content.id,
        externalId: content.externalId,
        provider: content.provider,
        contentType: content.contentType,
        title: content.title,
        author: content.author,
        score: content.score,
        viewCount: content.viewCount,
        createdAt: content.createdAt,
        processedAt: content.processedAt,
      })
      .from(content);

    // Apply filters conditionally and get items
    let items;
    if (provider && contentType) {
      items = await baseQuery
        .where(
          sql`${content.provider} = ${provider} AND ${content.contentType} = ${contentType}`
        )
        .orderBy(desc(content.processedAt))
        .limit(limit)
        .offset(offset);
    } else if (provider) {
      items = await baseQuery
        .where(sql`${content.provider} = ${provider}`)
        .orderBy(desc(content.processedAt))
        .limit(limit)
        .offset(offset);
    } else if (contentType) {
      items = await baseQuery
        .where(sql`${content.contentType} = ${contentType}`)
        .orderBy(desc(content.processedAt))
        .limit(limit)
        .offset(offset);
    } else {
      items = await baseQuery
        .orderBy(desc(content.processedAt))
        .limit(limit)
        .offset(offset);
    }

    // Get total count for pagination with same filtering logic
    const baseCountQuery = db.select({ count: count() }).from(content);
    let totalCount;
    if (provider && contentType) {
      [totalCount] = await baseCountQuery.where(
        sql`${content.provider} = ${provider} AND ${content.contentType} = ${contentType}`
      );
    } else if (provider) {
      [totalCount] = await baseCountQuery.where(
        sql`${content.provider} = ${provider}`
      );
    } else if (contentType) {
      [totalCount] = await baseCountQuery.where(
        sql`${content.contentType} = ${contentType}`
      );
    } else {
      [totalCount] = await baseCountQuery;
    }

    res.json({
      items,
      pagination: {
        page,
        limit,
        total: totalCount.count,
        pages: Math.ceil(totalCount.count / limit),
      },
      filters: {
        provider,
        contentType,
      },
    });
  } catch (error) {
    console.error("Error fetching content:", error);
    res.status(500).json({ error: "Failed to fetch content" });
  }
};

router.get("/stats", getDashboardStats);
router.get("/content", getContentOverview);

export { router as dashboardRouter };
