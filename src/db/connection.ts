import { appConfig } from "@/config/app-config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = appConfig.db.url;

// Create the connection
export const client = postgres(connectionString);

// Create the Drizzle database instance
export const db = drizzle(client);

// Helper function to close the connection
export const closeConnection = async () => {
  await client.end();
};
