"""
Eval: RAGAS-style LLM-as-Judge Runner
Evaluates answer quality using Groq as the evaluator LLM.
NO OpenAI dependency — runs entirely on Groq (free tier).

Metrics computed:
  - faithfulness:       Is the answer grounded in the retrieved context?
  - answer_relevancy:   Does the answer address the question asked?
  - context_precision:  Are the retrieved chunks actually relevant to the question?

Each metric is scored 0.0–1.0 via structured prompting.
"""

import json
import re
from app.models.schemas import EvalRequest, EvalResponse
from app.core.llm_provider import get_llm_client, get_model_name


# ---------------------------------------------------------------------------
# Scoring prompt templates
# ---------------------------------------------------------------------------

FAITHFULNESS_PROMPT = """You are an expert evaluator. Your task is to assess whether an AI answer is FAITHFUL to the provided context.

QUESTION: {question}

CONTEXT (retrieved code/text):
{context}

ANSWER:
{answer}

TASK: Score the faithfulness of the answer from 0.0 to 1.0.
- 1.0 = Answer is fully grounded in the context, no hallucinated facts
- 0.5 = Answer is partially grounded; some claims not in context
- 0.0 = Answer contradicts context or is entirely hallucinated

Respond ONLY with a JSON object in this exact format (no other text):
{{"score": 0.85, "reason": "brief explanation"}}"""


RELEVANCY_PROMPT = """You are an expert evaluator. Your task is to assess whether an AI answer is RELEVANT to the question.

QUESTION: {question}

ANSWER:
{answer}

TASK: Score the answer relevancy from 0.0 to 1.0.
- 1.0 = Answer directly and completely addresses the question
- 0.5 = Answer partially addresses the question or goes off-topic
- 0.0 = Answer is completely irrelevant to the question

Respond ONLY with a JSON object in this exact format (no other text):
{{"score": 0.9, "reason": "brief explanation"}}"""


CONTEXT_PRECISION_PROMPT = """You are an expert evaluator. Your task is to assess whether the retrieved CONTEXT is RELEVANT to the question.

QUESTION: {question}

CONTEXT (retrieved code/text):
{context}

TASK: Score the context precision from 0.0 to 1.0.
- 1.0 = All retrieved context is highly relevant to answering the question
- 0.5 = Mixed context, some relevant some not
- 0.0 = Retrieved context is completely irrelevant to the question

Respond ONLY with a JSON object in this exact format (no other text):
{{"score": 0.75, "reason": "brief explanation"}}"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_score(text: str) -> float:
    """Extract a float score from LLM JSON response, with fallback parsing."""
    try:
        # Try direct JSON parse first
        data = json.loads(text.strip())
        score = float(data.get("score", 0.5))
        return max(0.0, min(1.0, score))
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        pass

    # Fallback: regex to find the first float/int in the response
    match = re.search(r'"score"\s*:\s*([0-9]*\.?[0-9]+)', text)
    if match:
        try:
            return max(0.0, min(1.0, float(match.group(1))))
        except ValueError:
            pass

    return 0.5  # neutral fallback if parsing completely fails


async def _score(prompt: str) -> float:
    """Call the LLM with a scoring prompt and return the parsed 0-1 score."""
    client = get_llm_client()
    try:
        response = await client.chat.completions.create(
            model=get_model_name(),
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a precise evaluation assistant. "
                        "Always respond with only valid JSON as instructed."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.0,   # deterministic scoring
            max_tokens=128,
        )
        raw = response.choices[0].message.content or ""
        return _extract_score(raw)
    except Exception:
        return 0.5  # neutral on LLM failure — don't crash the eval pipeline


def _build_context_snippet(contexts: list[str], max_chars: int = 3000) -> str:
    """Truncate contexts to avoid exceeding token limits."""
    combined = "\n\n---\n\n".join(contexts)
    if len(combined) > max_chars:
        combined = combined[:max_chars] + "\n...(truncated)"
    return combined


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def run_ragas_evaluation(request: EvalRequest) -> EvalResponse:
    """
    Run LLM-as-Judge evaluation on a single question-answer-context triplet.

    All three metrics are run concurrently for speed. Each calls the configured
    LLM (Groq Llama 3.3 70B by default) with a structured scoring prompt and
    returns a 0–1 score.
    """
    import asyncio

    context_text = _build_context_snippet(request.contexts)

    faithfulness_prompt = FAITHFULNESS_PROMPT.format(
        question=request.question,
        context=context_text,
        answer=request.answer,
    )
    relevancy_prompt = RELEVANCY_PROMPT.format(
        question=request.question,
        answer=request.answer,
    )
    precision_prompt = CONTEXT_PRECISION_PROMPT.format(
        question=request.question,
        context=context_text,
    )

    # Run all three evaluations concurrently
    faithfulness, relevancy, precision = await asyncio.gather(
        _score(faithfulness_prompt),
        _score(relevancy_prompt),
        _score(precision_prompt),
    )

    overall = get_overall_grade(faithfulness, relevancy, precision)

    return EvalResponse(
        faithfulness=round(faithfulness, 3),
        answer_relevancy=round(relevancy, 3),
        context_precision=round(precision, 3),
        overall=overall,
        message_id=request.message_id,
    )


def get_overall_grade(faithfulness: float, relevancy: float, precision: float) -> str:
    """
    Compute an overall quality grade from individual metric scores.

    Returns:
      "high"   — average > 0.8
      "medium" — average 0.6–0.8
      "low"    — average < 0.6
    """
    avg = (faithfulness + relevancy + precision) / 3.0
    if avg > 0.8:
        return "high"
    elif avg >= 0.6:
        return "medium"
    else:
        return "low"
