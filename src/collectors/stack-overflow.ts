import { config } from "dotenv";
import { StackOverflowCollector } from "@/collectors/stack-overflow-collector";
import { closeConnection } from "@/db/connection";

// Load environment variables
config();

async function main() {
  try {
    console.log("Starting Stack Overflow collection...");

    const collector = new StackOverflowCollector();

    const options = {
      pages: 2, // Start small for testing
      tags: ["javascript", "typescript"],
      sort: "votes" as const,
      includeAnswers: true,
    };

    console.log("Collection options:", options);

    const job = await collector.startCollection(options);

    console.log("Collection completed successfully!");
    console.log("Job details:", {
      id: job.id,
      status: job.status,
      itemsCollected: job.itemsCollected,
      itemsProcessed: job.itemsProcessed,
    });
  } catch (error) {
    console.error("Collection failed:", error);
    process.exit(1);
  } finally {
    await closeConnection();
    console.log("Database connection closed.");
  }
}

main();
