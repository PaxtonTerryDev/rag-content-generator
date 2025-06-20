import express from "express";
import type { Express } from "express";

import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { collectorsRouter } from "@/routes/collectors";
import { dashboardRouter } from "@/routes/dashboard";
import { searchRouter } from "@/routes/search";
import { jobsRouter } from "@/routes/jobs"; // New job routes

const app: Express = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/collectors", collectorsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/search", searchRouter);
app.use("/api/jobs", jobsRouter); // New job routes

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Basic route
app.get("/", (req, res) => {
  res.json({
    message: "RAG Content Generator API",
    version: "1.0.0",
    endpoints: {
      collectors: "/api/collectors",
      dashboard: "/api/dashboard",
      search: "/api/search",
      jobs: "/api/jobs", // New endpoint
      health: "/health",
    },
  });
});

// Error handling middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
);

app.use("/*catchall", (req, res) => {
  res.status(404).json({
    error: "Not found",
    message: `Route ${req.originalUrl} not found`,
  });
});

export { app };
