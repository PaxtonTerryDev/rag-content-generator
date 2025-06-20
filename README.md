# RAG Content Generator

A TypeScript-based system for collecting, vectorizing, and searching content from public forums and websites (Stack Overflow, Reddit, Dev.to, etc.) using PostgreSQL with pgvector for semantic search capabilities.

## Features

- **Multi-source Data Collection**: Currently supports Stack Overflow with extensible architecture for Reddit, Dev.to, and Hacker News
- **Vector Search**: Uses OpenAI embeddings and pgvector for semantic similarity search
- **Full-text Search**: Fallback PostgreSQL text search functionality
- **REST API**: Express.js API with endpoints for collection management, search, and dashboard
- **Database Management**: Drizzle ORM with PostgreSQL and pgvector extension
- **Docker Support**: Containerized PostgreSQL with pgAdmin for easy development

## Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose
- pnpm (or npm/yarn)
- OpenAI API key

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd rag-content-generator
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   Copy the provided `.env` file or create your own with the following variables:

   ```env
   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key_here

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=rag
   DB_USER=admin
   DB_PASSWORD=password
   DB_URL=postgresql://admin:password@localhost:5432/rag

   # Collection Settings
   STACKOVERFLOW_PAGES=10
   DEVTO_PAGES=5
   HACKERNEWS_STORIES=100
   REDDIT_POSTS=1000

   # RAG Settings
   EMBEDDING_MODEL=text-embedding-3-small
   GENERATION_MODEL=gpt-3.5-turbo
   SIMILARITY_THRESHOLD=0.7
   CONTEXT_LENGTH=4000
   ```

4. **Start the database**

   ```bash
   pnpm docker:up
   ```

5. **Run database migrations**

   ```bash
   pnpm db:migrate
   ```

6. **Start the development server**
   ```bash
   pnpm dev
   ```

The API will be available at `http://localhost:3000` (or your configured port).

## Usage

### Starting Data Collection

#### Stack Overflow Collection

You can collect Stack Overflow content via the API or by running the dedicated script:

**Via API:**

```bash
curl -X POST http://localhost:3000/api/collectors/stackoverflow/collect \
  -H "Content-Type: application/json" \
  -d '{
    "pages": 5,
    "tags": ["javascript", "typescript", "python"],
    "sort": "votes",
    "includeAnswers": true
  }'
```

**Via Script:**

```bash
tsx src/collectors/stack-overflow.ts
```

### API Endpoints

#### Collection Management

- `GET /api/collectors/jobs` - List all collection jobs
- `GET /api/collectors/jobs/:id` - Get specific collection job
- `POST /api/collectors/stackoverflow/collect` - Start Stack Overflow collection
- `GET /api/collectors/available` - List available collectors

#### Search

- `POST /api/search/similar` - Vector similarity search

  ```json
  {
    "query": "How to handle async operations in JavaScript?",
    "limit": 10,
    "threshold": 0.7,
    "provider": "stackoverflow"
  }
  ```

- `POST /api/search/text` - Full-text search
  ```json
  {
    "query": "async await promise",
    "limit": 10,
    "provider": "stackoverflow"
  }
  ```

#### Dashboard

- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/content` - Get content overview with pagination

#### Health Check

- `GET /health` - Service health status
- `GET /` - API information and available endpoints

### Database Management

**Generate new migration:**

```bash
pnpm db:generate
```

**Apply migrations:**

```bash
pnpm db:migrate
```

**Open Drizzle Studio:**

```bash
pnpm db:studio
```

**Access pgAdmin:**
Visit `http://localhost:8080` with credentials:

- Email: `admin@pt.com`
- Password: `admin`

### Docker Commands

```bash
# Start containers
pnpm docker:up

# Stop containers
pnpm docker:down

# Rebuild containers
pnpm docker:rebuild
```

## Architecture

### Database Schema

**Content Table:**

- Stores collected content with metadata
- Includes vector embeddings for similarity search
- Supports multiple content types (question, answer, post, etc.)

**Collection Jobs Table:**

- Tracks collection job status and statistics
- Stores job configuration and error information

### Collectors

The system uses a base collector pattern (`BaseCollector`) that provides:

- Rate limiting and retry logic
- Embedding generation and storage
- Job management and status tracking

**Implemented Collectors:**

- **StackOverflowCollector**: Collects questions and answers from Stack Overflow API

**Planned Collectors:**

- Reddit collector
- Dev.to collector
- Hacker News collector

### Services

**EmbeddingService:**

- Generates OpenAI embeddings for text content
- Handles batch processing and token management
- Prepares text for optimal embedding generation

## Configuration

### Collection Options

**Stack Overflow:**

- `pages`: Number of pages to collect (default: 10)
- `tags`: Array of tags to filter by
- `sort`: Sort order ("creation", "votes", "activity")
- `includeAnswers`: Whether to collect answers (default: true)

### Rate Limiting

Each collector implements rate limiting to respect API quotas:

- Stack Overflow: 100ms between requests (~300/minute)
- Configurable retry logic with exponential backoff

## Development

### Adding New Collectors

1. Create a new collector class extending `BaseCollector`
2. Implement the `collect()` method
3. Add API endpoint in `src/routes/collectors.ts`
4. Update the provider enum in `src/db/schema.ts`

### Project Structure

```
src/
├── app.ts                 # Express app configuration
├── index.ts              # Server entry point
├── collectors/           # Data collection modules
│   ├── base-collector.ts
│   └── stack-overflow-collector.ts
├── config/              # Application configuration
│   └── app-config.ts
├── db/                  # Database related files
│   ├── connection.ts
│   ├── schema.ts
│   ├── migrations/
│   └── scripts/
├── routes/              # API route handlers
│   ├── collectors.ts
│   ├── dashboard.ts
│   └── search.ts
└── services/            # Business logic services
    └── EmbeddingService.ts
```

## Troubleshooting

### Common Issues

**Database Connection:**

- Ensure Docker containers are running: `pnpm docker:up`
- Check database credentials in `.env`
- Verify pgvector extension is installed

**OpenAI API:**

- Validate API key in `.env`
- Check API quota and billing status
- Monitor embedding generation costs

**Collection Failures:**

- Check API rate limits
- Verify internet connectivity
- Review collection job logs in database

### Logs and Monitoring

- Collection progress is logged to console
- Job status tracked in `collection_jobs` table
- API errors returned with detailed messages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with TypeScript types
4. Add tests if applicable
5. Submit a pull request

## License

ISC License

## Future Enhancements

- [ ] Reddit collector implementation
- [ ] Dev.to collector implementation
- [ ] Hacker News collector implementation
- [ ] Web UI dashboard
- [ ] Content deduplication
- [ ] Advanced filtering and faceted search
- [ ] Export functionality
- [ ] Scheduled collection jobs
- [ ] Content quality scoring
- [ ] Multi-language support
