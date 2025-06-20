import { Router } from "express";
import { db } from "@/db/connection";
import { collectionJobs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { StackOverflowCollector } from "@/collectors/stack-overflow-collector";

const router: Router = Router();

// Get all collection jobs
router.get("/jobs", async (req, res) => {
  try {
    const jobs = await db
      .select()
      .from(collectionJobs)
      .orderBy(desc(collectionJobs.startedAt))
      .limit(50);

    res.json(jobs);
  } catch (error) {
    console.error("Error fetching collection jobs:", error);
    res.status(500).json({ error: "Failed to fetch collection jobs" });
  }
});

// Get collection job by ID
router.get("/jobs/:id", async (req, res): Promise<any> => {
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) {
      return res.status(400).json({ error: "Invalid job ID" });
    }

    const [job] = await db
      .select()
      .from(collectionJobs)
      .where(eq(collectionJobs.id, jobId))
      .limit(1);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json(job);
  } catch (error) {
    console.error("Error fetching collection job:", error);
    res.status(500).json({ error: "Failed to fetch collection job" });
  }
});

// Start Stack Overflow collection
router.post("/stackoverflow/collect", async (req, res) => {
  try {
    const options = req.body;
    console.log("Starting Stack Overflow collection with options:", options);

    const collector = new StackOverflowCollector();

    // Start collection in background
    collector
      .startCollection(options)
      .then((job) => {
        console.log("Stack Overflow collection completed:", job);
      })
      .catch((error) => {
        console.error("Stack Overflow collection failed:", error);
      });

    res.json({
      message: "Stack Overflow collection started",
      provider: "stackoverflow",
      options,
    });
  } catch (error) {
    console.error("Error starting Stack Overflow collection:", error);
    res.status(500).json({ error: "Failed to start collection" });
  }
});

// Get available collectors
router.get("/available", (req, res) => {
  res.json([
    {
      name: "stackoverflow",
      displayName: "Stack Overflow",
      description: "Collect questions and answers from Stack Overflow",
      options: {
        pages: {
          type: "number",
          default: 10,
          description: "Number of pages to collect",
        },
        tags: {
          type: "array",
          default: ["javascript", "typescript", "python"],
          description: "Tags to filter by",
        },
        sort: {
          type: "string",
          default: "creation",
          options: ["creation", "votes", "activity"],
        },
        includeAnswers: {
          type: "boolean",
          default: true,
          description: "Include answers in collection",
        },
      },
    },
    // Future collectors will be added here
  ]);
});

export { router as collectorsRouter };
