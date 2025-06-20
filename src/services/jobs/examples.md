```typescript
// Job System Usage Examples

// 1. Queue a one-time Stack Overflow collection
const response = await fetch("/api/jobs/queue", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    type: "stackoverflow-collection",
    payload: {
      pages: 5,
      tags: ["react", "nextjs"],
      sort: "votes",
      includeAnswers: true,
    },
    options: {
      priority: 2, // Higher priority
      maxAttempts: 5,
      delay: 0, // Run immediately
    },
  }),
});

// 2. Schedule a daily collection
await fetch("/api/jobs/schedule", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "nightly-js-collection",
    cron: "0 2 * * *", // 2 AM daily
    jobType: "stackoverflow-collection",
    payload: {
      pages: 10,
      tags: ["javascript", "typescript"],
      sort: "creation",
    },
  }),
});

// 3. Monitor job queue
const stats = await fetch("/api/jobs/stats").then((r) => r.json());
/*
  Response:
  {
    "workers": 2,
    "maxConcurrentJobs": 3,
    "isProcessing": true,
    "statusCounts": {
      "pending": 5,
      "processing": 2,
      "completed": 150,
      "failed": 3
    }
  }
  */
```
