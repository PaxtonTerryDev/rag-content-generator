import { config } from "dotenv";

config();

type Protocol = "http" | "https";

export interface AppConfig {
  server: {
    protocol: Protocol;
    hostname: string;
    port: number;
    baseURL: string;
  };
  db: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    url: string;
  };
  api: {
    openAI: {
      key: string;
    };
    reddit: {
      clientId: string;
      secret: string;
      userAgent: string;
    };
  };
  defaults: {
    collectors: {
      stackOverflow: { pages: number };
      devto: { pages: number };
      hackerNews: { pages: number };
      reddit: { posts: number };
    };
    models: {
      embedding: string;
      generation: string;
    };
    similarityThreshold: number;
    contextLength: number;
  };
}

function getEnv<T>(inVar: string): T {
  const envVal = process.env[inVar];
  if (envVal === undefined) {
    throw new Error(`Missing env value ${inVar}, which is required`);
  }
  return envVal as T;
}

export const appConfig: AppConfig = {
  db: {
    host: getEnv("DB_HOST"),
    port: getEnv<number>("DB_PORT"),
    name: getEnv("DB_NAME"),
    user: getEnv("DB_USER"),
    password: getEnv("DB_PASSWORD"),
    url: `postgresql://${getEnv("DB_USER")}:${getEnv("DB_PASSWORD")}@${getEnv(
      "DB_HOST"
    )}:${getEnv("DB_PORT")}/${getEnv("DB_NAME")}`,
  },
  api: {
    openAI: {
      key: getEnv("OPENAI_API_KEY"),
    },
    reddit: {
      clientId: getEnv("REDDIT_CLIENT_ID"),
      secret: getEnv("REDDIT_CLIENT_SECRET"),
      userAgent: getEnv("REDDIT_USER_AGENT"),
    },
  },
  defaults: {
    collectors: {
      stackOverflow: {
        pages: getEnv<number>("STACKOVERFLOW_PAGES"),
      },
      devto: {
        pages: getEnv<number>("DEVTO_PAGES"),
      },
      hackerNews: {
        pages: getEnv<number>("HACKERNEWS_STORIES"),
      },
      reddit: {
        posts: getEnv<number>("REDDIT_POSTS"),
      },
    },
    models: {
      embedding: getEnv("EMBEDDING_MODEL"),
      generation: getEnv("GENERATION_MODEL"),
    },
    similarityThreshold: getEnv<number>("SIMILARITY_THRESHOLD"),
    contextLength: getEnv<number>("CONTEXT_LENGTH"),
  },
  server: {
    protocol: getEnv("API_PROTOCOL"),
    hostname: getEnv("API_HOST"),
    port: getEnv<number>("API_PORT"),
    baseURL: `${getEnv("API_PROTOCOL")}://${getEnv(
      "API_HOST"
    )}:${getEnv<number>("API_PORT")}`,
  },
};
