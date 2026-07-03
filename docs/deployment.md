# RepoTalk Deployment

## Recommended Hosting

Use Vercel for the Next.js frontend and Render for the two backend services.
Render is the best fit here because RepoTalk has long-running HTTP services, Dockerfiles, health checks, and a multi-service Blueprint. Railway is also easy, but the Render Blueprint is clearer for a recruiter-facing, reproducible demo. Google Cloud Run is powerful, but it adds more IAM, registry, and billing setup than this project needs right now.

## Frontend: Vercel

Create a Vercel project from this repository with `frontend` as the root directory.

Set these environment variables:

- `NEXT_PUBLIC_GATEWAY_URL`: the deployed Render gateway URL
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk live publishable key (`pk_live_...` for production)
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`: `/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`: `/sign-up`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`: `/ingest`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`: `/ingest`

Build settings are in `frontend/vercel.json`.

## Backend: Render

Use the root `render.yaml` Blueprint. It creates:

- `repotalk-ai-service`: FastAPI RAG service
- `repotalk-gateway`: Express gateway

Fill all `sync: false` secrets in the Render dashboard before applying the Blueprint:

- `GROQ_API_KEY`
- `QDRANT_URL`
- `QDRANT_API_KEY`
- `DATABASE_URL`
- `DIRECT_URL`
- `CLERK_SECRET_KEY`
- `FRONTEND_URL`
- `NEXT_PUBLIC_APP_URL`
- `CORS_ORIGINS`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Stripe and Langfuse variables can stay blank unless those features are enabled.

## Production Checklist

- Use managed PostgreSQL for `DATABASE_URL`; do not use SQLite in production.
- Use Clerk live keys for production: `pk_live_...` on Vercel and `sk_live_...` on Render.
- The gateway container uses `gateway/prisma/schema.production.prisma`; local development keeps `gateway/prisma/schema.prisma` on SQLite.
- Use Qdrant Cloud for vectors; do not use embedded local Qdrant in production.
- Set `FRONTEND_URL`, `NEXT_PUBLIC_APP_URL`, and `CORS_ORIGINS` to the Vercel production URL.
- Keep `ALLOW_VERCEL_PREVIEWS=true` only if preview deployments need gateway access.
- Verify `https://<gateway>/health` and `https://<ai-service>/health` after deploy.
