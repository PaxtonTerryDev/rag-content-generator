import axios from "axios";
import {
  BaseCollector,
  CollectedItem,
  CollectorConfig,
} from "@/collectors/base-collector";
import { appConfig } from "@/config/app-config";

interface StackOverflowQuestion {
  question_id: number;
  title: string;
  body?: string;
  owner?: {
    display_name: string;
  };
  creation_date: number;
  link: string;
  tags: string[];
  score: number;
  view_count: number;
  answer_count: number;
  is_answered: boolean;
}

interface StackOverflowAnswer {
  answer_id: number;
  question_id: number;
  body?: string;
  owner?: {
    display_name: string;
  };
  creation_date: number;
  score: number;
  is_accepted: boolean;
}

interface StackOverflowResponse<T> {
  items: T[];
  has_more: boolean;
  quota_max: number;
  quota_remaining: number;
  page?: number;
  total?: number;
}

export interface StackOverflowCollectorOptions {
  pages?: number;
  tags?: string[];
  sort?: "creation" | "votes" | "activity";
  includeAnswers?: boolean;
}

export class StackOverflowCollector extends BaseCollector {
  private baseUrl = "https://api.stackexchange.com/2.3";
  private site = "stackoverflow";

  constructor() {
    const config: CollectorConfig = {
      rateLimitMs: 100, // Stack Overflow allows ~300 requests/minute
      batchSize: 100,
      maxRetries: 3,
    };
    super("stackoverflow", config);
  }

  async collect(
    options?: StackOverflowCollectorOptions
  ): Promise<CollectedItem[]> {
    const {
      pages = appConfig.defaults.collectors.stackOverflow.pages,
      tags = ["javascript", "typescript", "python", "react", "nodejs"],
      sort = "creation",
      includeAnswers = true,
    } = options || {};

    console.log(
      `Collecting Stack Overflow questions with tags: ${tags.join(", ")}`
    );

    const items: CollectedItem[] = [];

    // Collect questions
    for (let page = 1; page <= pages; page++) {
      try {
        const questions = await this.fetchQuestions(page, tags, sort);

        for (const question of questions) {
          const questionItem = this.transformQuestion(question);
          items.push(questionItem);

          // Fetch answers if requested
          if (includeAnswers && question.answer_count > 0) {
            try {
              const answers = await this.fetchAnswers(question.question_id);
              const answerItems = answers.map((answer) =>
                this.transformAnswer(answer, question)
              );
              items.push(...answerItems);
            } catch (error) {
              console.error(
                `Failed to fetch answers for question ${question.question_id}:`,
                error
              );
            }
          }
        }

        console.log(
          `Collected page ${page}/${pages} - ${questions.length} questions`
        );
      } catch (error) {
        console.error(`Failed to fetch page ${page}:`, error);
        break;
      }
    }

    return items;
  }

  private async fetchQuestions(
    page: number,
    tags: string[],
    sort: string
  ): Promise<StackOverflowQuestion[]> {
    const url = `${this.baseUrl}/questions`;
    const params = {
      site: this.site,
      page,
      pagesize: 100,
      order: "desc",
      sort,
      tagged: tags.join(";"),
      filter: "withbody", // Include question body
    };

    const response = await this.rateLimitedRequest(async () => {
      return axios.get<StackOverflowResponse<StackOverflowQuestion>>(url, {
        params,
      });
    });

    console.log(`API quota remaining: ${response.data.quota_remaining}`);
    return response.data.items;
  }

  private async fetchAnswers(
    questionId: number
  ): Promise<StackOverflowAnswer[]> {
    const url = `${this.baseUrl}/questions/${questionId}/answers`;
    const params = {
      site: this.site,
      pagesize: 10, // Limit answers per question
      order: "desc",
      sort: "votes",
      filter: "withbody", // Include answer body
    };

    const response = await this.rateLimitedRequest(async () => {
      return axios.get<StackOverflowResponse<StackOverflowAnswer>>(url, {
        params,
      });
    });

    return response.data.items;
  }

  private transformQuestion(question: StackOverflowQuestion): CollectedItem {
    return {
      externalId: question.question_id.toString(),
      contentType: "question",
      title: question.title,
      body: question.body || "",
      author: question.owner?.display_name,
      createdAt: new Date(question.creation_date * 1000),
      sourceUrl: question.link,
      tags: question.tags,
      score: question.score,
      viewCount: question.view_count,
      commentCount: question.answer_count,
      metadata: {
        is_answered: question.is_answered,
        answer_count: question.answer_count,
      },
    };
  }

  private transformAnswer(
    answer: StackOverflowAnswer,
    question: StackOverflowQuestion
  ): CollectedItem {
    return {
      externalId: answer.answer_id.toString(),
      contentType: "answer",
      title: `Answer to: ${question.title}`,
      body: answer.body || "",
      author: answer.owner?.display_name,
      createdAt: new Date(answer.creation_date * 1000),
      sourceUrl: `${question.link}#${answer.answer_id}`,
      tags: question.tags,
      score: answer.score,
      viewCount: 0,
      commentCount: 0,
      metadata: {
        question_id: answer.question_id,
        is_accepted: answer.is_accepted,
      },
    };
  }
}
