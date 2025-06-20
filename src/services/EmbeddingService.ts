import OpenAI from "openai";
import { appConfig } from "@/config/app-config";

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

export class EmbeddingService {
  private openai: OpenAI;
  private model: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: appConfig.api.openAI.key,
    });
    this.model = appConfig.defaults.models.embedding;
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text,
        encoding_format: "float",
      });

      const embedding = response.data[0].embedding;
      const tokens = response.usage?.total_tokens || 0;

      return {
        embedding,
        tokens,
      };
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw new Error("Failed to generate embedding");
    }
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: texts,
        encoding_format: "float",
      });

      return response.data.map((item, index) => ({
        embedding: item.embedding,
        tokens: Math.floor((response.usage?.total_tokens || 0) / texts.length),
      }));
    } catch (error) {
      console.error("Error generating embeddings:", error);
      throw new Error("Failed to generate embeddings");
    }
  }

  prepareTextForEmbedding(title: string | null, content: string): string {
    const titlePart = title ? `Title: ${title}\n\n` : "";
    const contentPart = `Content: ${content}`;

    // Truncate if too long (embedding models have token limits)
    const combined = titlePart + contentPart;
    return combined.length > 8000
      ? combined.substring(0, 8000) + "..."
      : combined;
  }
}
