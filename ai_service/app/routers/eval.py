"""
Router: /api/v1/eval
RAGAS-style LLM-as-Judge evaluation — scores each answer for faithfulness,
answer relevancy, and context precision using Groq as the evaluator LLM.
No OpenAI dependency. Fully free.
"""

import json
from fastapi import APIRouter, HTTPException
from app.models.schemas import EvalRequest, EvalResponse
from app.eval.ragas_runner import run_ragas_evaluation

router = APIRouter()


@router.post("/score", response_model=EvalResponse, summary="Evaluate a single QA pair")
async def score_answer(request: EvalRequest):
    """
    Run LLM-as-Judge evaluation on a single QA triplet.

    Metrics:
      - faithfulness:       Is the answer grounded in the retrieved context?
      - answer_relevancy:   Does the answer address the question?
      - context_precision:  Are the retrieved chunks relevant to the question?

    Uses Groq (Llama 3.3 70B) as the evaluator. All three metrics are run
    concurrently for minimal latency. Scores stored in DB by the gateway.
    """
    try:
        result = await run_ragas_evaluation(request)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Evaluation failed: {str(e)}"
        )


@router.get("/dashboard/{repo_id}", summary="Get evaluation stats for a repo")
async def get_eval_dashboard(repo_id: str):
    """
    Return aggregated RAGAS metrics for the evaluation dashboard.
    The gateway calls this after querying its DB for message ragasScore fields.
    This endpoint exists as a direct AI-service pass-through for future use.
    Currently, aggregation is done on the gateway side.
    """
    # Aggregation is done by the gateway using its DB.
    # AI service acknowledges this is a gateway-aggregated endpoint.
    return {
        "repo_id": repo_id,
        "note": "Dashboard aggregation is handled by the gateway.",
    }


@router.post("/batch", summary="Run offline batch evaluation")
async def batch_evaluate(repo_id: str, dataset: list[dict]):
    """
    Run LLM-as-Judge evaluation on a pre-built Q&A dataset.
    Input: [{ question, answer, contexts, message_id }]
    Output: list of EvalResponse with per-question scores.
    """
    import asyncio

    async def eval_one(item: dict) -> dict:
        try:
            req = EvalRequest(
                question=item.get("question", ""),
                answer=item.get("answer", ""),
                contexts=item.get("contexts", []),
                repo_id=repo_id,
                message_id=item.get("message_id", "batch"),
            )
            result = await run_ragas_evaluation(req)
            return result.model_dump()
        except Exception as e:
            return {"error": str(e), "message_id": item.get("message_id", "batch")}

    results = await asyncio.gather(*[eval_one(item) for item in dataset])
    avg_faithfulness = sum(r.get("faithfulness", 0) for r in results if "faithfulness" in r) / max(len(results), 1)
    avg_relevancy = sum(r.get("answer_relevancy", 0) for r in results if "answer_relevancy" in r) / max(len(results), 1)
    avg_precision = sum(r.get("context_precision", 0) for r in results if "context_precision" in r) / max(len(results), 1)

    return {
        "repo_id": repo_id,
        "total": len(results),
        "aggregate": {
            "avg_faithfulness": round(avg_faithfulness, 3),
            "avg_relevancy": round(avg_relevancy, 3),
            "avg_precision": round(avg_precision, 3),
        },
        "results": results,
    }
