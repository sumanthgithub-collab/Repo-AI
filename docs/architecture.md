# RepoTalk — Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Vercel)                           │
│            Next.js 14 · App Router · shadcn/ui · Clerk          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────────┐
│                NODE.JS GATEWAY (Render)                         │
│         Express · Clerk JWT verify · Rate limit                 │
│   Routes: /api/repos · /api/sessions · /api/chat · /api/eval   │
│   DB:     Supabase PostgreSQL via Prisma ORM                    │
│   Cache:  Upstash Redis                                         │
│   SSE:    Streams AI responses to frontend                      │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP (internal)
              ┌──────────▼──────────────┐
              │  FASTAPI AI SERVICE     │
              │  (Render)               │
              │                         │
              │  POST /api/v1/ingest    │ ← Clone + Parse + Embed
              │  POST /api/v1/query     │ ← Retrieve + Generate
              │  GET  /api/v1/symbols   │ ← AST lookup
              │  POST /api/v1/eval      │ ← RAGAS scoring
              │  POST /api/v1/persona   │ ← Repo profiling
              │  POST /api/v1/pr        │ ← PR summarizer
              │                         │
              │  LLM:        Groq API   │ ← Llama 3.3 70B (free)
              │  Fallback:   Ollama     │ ← Local models
              │  Embeddings: local      │ ← nomic-embed-code-v1
              │  Vector DB:  Qdrant     │ ← Cloud free tier
              └─────────────────────────┘
```

## Data Flow: User Asks a Question

```
1. User types question in chat UI (Next.js)
2. Frontend POSTs to Node gateway /api/chat/stream
3. Gateway verifies Clerk JWT → extracts userId
4. Gateway rate-limits (Upstash Redis: 20 req/min)
5. Gateway forwards to FastAPI /api/v1/query/stream
6. FastAPI:
   a. Embeds question → nomic-embed-code-v1 (local)
   b. Hybrid search in Qdrant (vector + BM25) → top 5 chunks
   c. Builds grounding prompt with retrieved context
   d. Calls Groq API (Llama 3.3 70B) → streams response
   e. Extracts file:line citations from response
7. FastAPI streams tokens back to Gateway (SSE)
8. Gateway pipes SSE stream to frontend
9. Frontend renders tokens word-by-word (StreamingText component)
10. On stream end: Gateway saves message + citations to Supabase
11. RAGAS evaluation runs async → stores score → updates UI badge
```

## Deployment Topology

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | repotalk.vercel.app |
| Node Gateway | Render | repotalk-gateway.onrender.com |
| FastAPI | Render | repotalk-ai.onrender.com |
| Qdrant | Qdrant Cloud | cluster.cloud.qdrant.io |
| PostgreSQL | Supabase | db.project.supabase.co |
| Redis | Upstash | redis.upstash.io |
