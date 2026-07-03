"""
RepoTalk — Phase 1 End-to-End Test
====================================
Prerequisites:
  docker-compose -f docker-compose.phase1.yml up --build -d
  (wait ~60s for services to start, then run:)
  python test_phase1.py

What this tests:
  1. Health check — AI service is alive, Qdrant is connected
  2. Ingestion — clone a real repo, chunk & embed it, store in Qdrant
  3. Status polling — wait for ingestion to complete
  4. Non-streaming query — ask a question, verify answer + citations
  5. Streaming query (SSE) — verify token stream arrives
"""

import httpx
import time
import json
import sys
import uuid

BASE_URL   = "http://localhost:8000"
TEST_REPO  = "https://github.com/S-V-Kartheek/-feedback-submission-and-management-system"  # very small lib for fast testing
REPO_ID    = f"test-{uuid.uuid4().hex[:8]}"
USER_ID    = "test-user-001"
SESSION_ID = f"test-session-{uuid.uuid4().hex[:8]}"

SEPARATOR = "=" * 65


def ok(msg):    print(f"  ✅ {msg}")
def fail(msg):  print(f"  ❌ {msg}"); sys.exit(1)
def info(msg):  print(f"  ℹ  {msg}")
def warn(msg):  print(f"  ⚠️  {msg}")
def header(h):  print(f"\n{SEPARATOR}\n  {h}\n{SEPARATOR}")


# ---------------------------------------------------------------------------
# 1. Health check
# ---------------------------------------------------------------------------
def test_health():
    header("Test 1 — Health Check")
    try:
        r = httpx.get(f"{BASE_URL}/health", timeout=15)
        r.raise_for_status()
        data = r.json()
        assert data["status"] == "ok", f"Unexpected status: {data}"
        ok(f"Service is alive!")
        ok(f"LLM provider: {data['llm']['provider']} → {data['llm']['model']}")
    except httpx.ConnectError:
        fail(
            "Cannot connect to http://localhost:8000\n"
            "  → Make sure Docker is running:\n"
            "  → docker-compose -f docker-compose.phase1.yml up --build -d"
        )
    except Exception as e:
        fail(f"Health check failed: {e}")


# ---------------------------------------------------------------------------
# 2. Ingest (background job — returns immediately)
# ---------------------------------------------------------------------------
def test_ingest_start():
    header("Test 2 — Start Repo Ingestion")
    info(f"Repo:   {TEST_REPO}")
    info(f"RepoID: {REPO_ID}")

    payload = {
        "repo_url":  TEST_REPO,
        "repo_id":   REPO_ID,
        "user_id":   USER_ID,
        "languages": ["js", "ts", "jsx", "tsx", "py", "java", "sql", "html"],       # Expanded to include web app languages
    }
    try:
        r = httpx.post(f"{BASE_URL}/api/v1/ingest/", json=payload, timeout=30)
        r.raise_for_status()
        data = r.json()
        info(f"Response: {json.dumps(data, indent=2)}")
        assert data.get("status") == "ingesting", f"Expected 'ingesting', got: {data}"
        ok("Ingestion started in background")
        return True
    except httpx.HTTPStatusError as e:
        fail(f"HTTP {e.response.status_code}: {e.response.text[:500]}")
    except Exception as e:
        fail(f"Ingest start failed: {e}")


# ---------------------------------------------------------------------------
# 3. Poll ingestion status
# ---------------------------------------------------------------------------
def test_ingest_wait():
    header("Test 3 — Waiting for Ingestion to Complete")
    info("Polling /api/v1/ingest/{repo_id}/status every 10s...")
    info("(First run downloads ~150MB embedding model — may take 5-10 minutes)")
    
    max_wait   = 900  # 15 minutes
    poll_every = 10   # seconds
    elapsed    = 0
    
    while elapsed < max_wait:
        time.sleep(poll_every)
        elapsed += poll_every
        
        try:
            r = httpx.get(f"{BASE_URL}/api/v1/ingest/{REPO_ID}/status", timeout=15)
            if r.status_code == 404:
                warn(f"Status not found yet (elapsed: {elapsed}s)...")
                continue
            r.raise_for_status()
            data = r.json()
            status = data.get("status", "unknown")
            stage = data.get("current_stage", "")
            pct = data.get("progress_pct", 0.0)
            chunks = data.get("embedded_chunks", data.get("chunks", 0))
            
            info(f"  [{elapsed:4d}s] status={status!r} ({pct}%) | stage={stage!r} | embedded_chunks={chunks}")
            
            if status == "done":
                ok(f"Ingestion complete! ({data.get('total_chunks', chunks)} chunks)")
                return True
            elif status == "error":
                fail(f"Ingestion failed with error: {data.get('error', 'unknown')}")
        except Exception as e:
            warn(f"Poll error (will retry): {e}")
    
    fail(f"Timed out after {max_wait}s waiting for ingestion to complete")


# ---------------------------------------------------------------------------
# 4. Non-streaming query
# ---------------------------------------------------------------------------
def test_query():
    header("Test 4 — Non-Streaming Query")
    questions = [
        "What are the technologies used in this project?",
        "What is the database name created when running the database.sql file?",
    ]

    for question in questions:
        info(f"Q: {question}")
        payload = {
            "repo_id":    REPO_ID,
            "question":   question,
            "session_id": SESSION_ID,
            "top_k":      5,
        }
        try:
            r = httpx.post(f"{BASE_URL}/api/v1/query/", json=payload, timeout=120)
            r.raise_for_status()
            data = r.json()
        except httpx.HTTPStatusError as e:
            fail(f"Query HTTP {e.response.status_code}: {e.response.text[:500]}")
        except Exception as e:
            fail(f"Query failed: {e}")

        answer    = data.get("answer", "")
        citations = data.get("citations", [])
        model     = data.get("model_used", "unknown")

        assert len(answer) > 10, f"Answer too short: {answer!r}"
        ok(f"Model: {model}")
        ok(f"Answer length: {len(answer)} chars | Citations: {len(citations)}")

        if citations:
            c = citations[0]
            info(f"  First citation → {c.get('file')} L{c.get('start_line')}-{c.get('end_line')}")
            info(f"  Snippet preview: {c.get('snippet', '')[:100]}...")
        else:
            warn("No citations returned (Groq answered without referencing specific files)")

        # Print the first 300 chars of the answer
        info(f"  Answer: {answer[:300]}{'...' if len(answer) > 300 else ''}")
        print()


# ---------------------------------------------------------------------------
# 5. Streaming query (SSE)
# ---------------------------------------------------------------------------
def test_streaming_query():
    header("Test 5 — Streaming Query (SSE)")
    question = "Explain how the feedback submission process works in this codebase."
    info(f"Q: {question}")

    payload = {
        "repo_id":    REPO_ID,
        "question":   question,
        "session_id": SESSION_ID,
        "top_k":      5,
    }

    tokens_received = 0
    full_text       = ""
    citations       = []

    try:
        with httpx.stream(
            "POST",
            f"{BASE_URL}/api/v1/query/stream",
            json=payload,
            timeout=httpx.Timeout(30.0, read=120.0),
        ) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                line = line.strip()
                if not line or not line.startswith("data:"):
                    continue
                raw = line[5:].strip()
                try:
                    event = json.loads(raw)
                    if "token" in event:
                        full_text += event["token"]
                        tokens_received += 1
                    elif event.get("done"):
                        citations = event.get("citations", [])
                        break
                    elif "error" in event:
                        fail(f"SSE error event: {event['error']}")
                except json.JSONDecodeError:
                    pass
    except Exception as e:
        fail(f"Streaming request failed: {e}")

    assert tokens_received > 0, "No SSE tokens received — streaming is broken"
    assert len(full_text)   > 50, f"Streamed text too short: {full_text!r}"

    ok(f"Received {tokens_received} SSE token events")
    ok(f"Total chars streamed: {len(full_text)}")
    ok(f"Citations in done event: {len(citations)}")
    info(f"  Preview: {full_text[:250]}...")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"\n🚀 RepoTalk Phase 1 — End-to-End Test Suite")
    print(f"   Target:  {BASE_URL}")
    print(f"   Repo:    {TEST_REPO}")
    print(f"   Repo ID: {REPO_ID}")

    test_health()
    test_ingest_start()
    test_ingest_wait()
    test_query()
    test_streaming_query()

    print(f"\n{SEPARATOR}")
    print(f"  🎉 All Phase 1 tests passed!")
    print(f"{SEPARATOR}\n")
