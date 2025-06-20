// src/index.ts (updated to start job processing)
import { appConfig } from "./config/app-config";
import { app } from "./app";
import { jobQueue, initializeDefaultJobs } from "./services";

const { baseURL, port } = appConfig.server;

// Graceful shutdown handler
const shutdown = (signal: string) => {
  console.log(`Received ${signal}. Starting shutdown...`);

  // Stop job processing
  jobQueue.stopProcessing();

  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error(
      "Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 10000);
};

// Start server
const server = app.listen(port, () => {
  console.log(`RAG Content Generator API running on port ${port}`);
  console.log(`Dashboard available at ${baseURL}/api/dashboard/stats`);
  console.log(
    `Database: ${appConfig.db.name}@${appConfig.db.host}:${appConfig.db.port}`
  );

  // Start job queue processing
  console.log("Starting job queue...");
  jobQueue.startProcessing();

  // Initialize default scheduled jobs
  initializeDefaultJobs();
  console.log("Default scheduled jobs initialized");
});

// Handle shutdown
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});
