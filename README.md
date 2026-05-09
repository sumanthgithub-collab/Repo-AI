# 🗣️ RepoTalk — Chat with Any GitHub Repository

> An AI-powered developer tool that lets you have a natural language conversation with any GitHub repository. Powered by a RAG pipeline with AST-aware chunking, hybrid vector search, and grounded answers with file:line citations.

![RepoTalk Demo](./docs/demo.gif)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)](https://fastapi.tiangolo.com)
[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org)
[![Qdrant](https://img.shields.io/badge/Qdrant-Vector%20DB-red)](https://qdrant.tech)

---

## ✨ Features

- 🔗 **Repo Ingestion** — Paste any public GitHub URL and ingest it in seconds
- 💬 **RAG-Powered Chat** — Ask questions grounded in actual code, not hallucinations
- 📍 **File:Line Citations** — Every answer links back to exact source code locations
- 🌳 **AST-Aware Chunking** — Tree-sitter parses code so chunks never cut mid-function
- 🔍 **Hybrid Search** — Vector similarity + BM25 keyword matching for precise retrieval
- 📊 **RAGAS Evaluation** — Every answer is automatically scored for faithfulness & relevancy
- 🧬 **Repo Persona** — Auto-generated onboarding guide, architecture overview, tech stack detection
- 🔀 **PR Summarizer** — Paste a PR URL, get a plain-English impact summary
- 🕐 **Multi-Turn Memory** — Conversations remember context across messages
- 🔐 **Auth & Sessions** — Clerk authentication with persistent chat history

---

## 🏗️ Architecture

```
Frontend (Next.js 14 / Vercel)
        │
        ▼
Node.js Gateway (Express / Render)    ← Auth, Sessions, SSE Streaming
        │
        ├──► FastAPI AI Service        ← Ingestion, Embeddings, Retrieval, LLM
        │         │
        │         ├──► Qdrant Cloud    ← Vector Store
        │         ├──► Groq API        ← LLM Inference (Llama 3.3 70B)
        │         └──► Ollama (fallback)
        │
        └──► Supabase PostgreSQL       ← Users, Sessions, Messages
```

**Full architecture doc:** [docs/architecture.md](./docs/architecture.md)

---

## 🆓 Free Stack

| Component | Tool | Cost |
|-----------|------|------|
| LLM | Groq API (Llama 3.3 70B) + Ollama fallback | $0 |
| Embeddings | nomic-embed-code-v1 (local) | $0 |
| Vector DB | Qdrant Cloud free tier | $0 |
| SQL DB | Supabase free tier | $0 |
| Auth | Clerk free tier | $0 |
| Cache | Upstash Redis free tier | $0 |
| Frontend deploy | Vercel Hobby | $0 |
| Backend deploy | Render free tier | $0 |

---

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker + Docker Compose
- Ollama (for local LLM)

### 1. Clone & Setup
```bash
git clone https://github.com/S-V-Kartheek/repochat-ai.git
cd repochat-ai
cp .env.example .env
# Fill in your API keys in .env
```

### 2. Start Everything with Docker Compose
```bash
docker-compose up --build
```

This starts:
- **Qdrant** at http://localhost:6333
- **Node.js Gateway** at http://localhost:4000
- **FastAPI AI Service** at http://localhost:8000
- **Frontend** at http://localhost:3000

### 3. Manual Setup (without Docker)

**Backend — AI Service:**
```bash
cd ai_service
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Backend — Node Gateway:**
```bash
cd gateway
npm install
npm run dev                  # Starts on port 4000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev                  # Starts on port 3000
```

---

## 📁 Project Structure

```
repochat-ai/
├── frontend/        # Next.js 14 App Router + shadcn/ui
├── gateway/         # Node.js Express API Gateway
├── ai_service/      # FastAPI AI/ML Pipeline
├── docs/            # Architecture, API docs
├── scripts/         # Dev utilities
└── docker-compose.yml
```

Full structure: [docs/project-structure.md](./docs/project-structure.md)

---

## 📊 Evaluation Results

Run on `facebook/react` repository (500+ Q&A pairs):

| Metric | Score |
|--------|-------|
| Faithfulness | 0.87 |
| Answer Relevancy | 0.83 |
| Context Precision | 0.79 |
| Avg Response Latency | < 3s |

---

## 🛣️ Roadmap

- [x] Phase 1: Core RAG pipeline (ingestion + retrieval + generation)
- [ ] Phase 2: Frontend + persistent chat history
- [ ] Phase 3: RAGAS evaluation + dashboard
- [ ] Phase 4: Repo persona + PR summarizer
- [ ] Phase 5: Security + CI/CD + Docker

---

## 🤝 Contributing

PRs welcome! See [CONTRIBUTING.md](./docs/CONTRIBUTING.md).

---

## 📄 License

MIT — see [LICENSE](./LICENSE).
