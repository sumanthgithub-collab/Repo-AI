import { aiClient } from "./aiProxy";

export interface RagasScore {
  faithfulness: number;
  answerRelevancy: number;
  contextPrecision: number;
  overall: number;
  grade: "high" | "medium" | "low";
}

interface AiEvalResponse {
  faithfulness: number;
  answer_relevancy: number;
  context_precision: number;
  overall: "high" | "medium" | "low";
}

function fallbackGrade(overall: number): "high" | "medium" | "low" {
  if (overall >= 0.8) return "high";
  if (overall >= 0.6) return "medium";
  return "low";
}

function fallbackScore(contexts: string[]): RagasScore {
  const hasContext = contexts.some((context) => context.trim().length > 0);
  const faithfulness = hasContext ? 0.65 : 0.2;
  const answerRelevancy = hasContext ? 0.6 : 0.2;
  const contextPrecision = hasContext ? 0.6 : 0.15;
  const overall = Number(((faithfulness + answerRelevancy + contextPrecision) / 3).toFixed(2));

  return {
    faithfulness,
    answerRelevancy,
    contextPrecision,
    overall,
    grade: fallbackGrade(overall),
  };
}

export async function scoreAnswer(payload: {
  repoId: string;
  messageId: string;
  question: string;
  answer: string;
  contexts: string[];
}): Promise<RagasScore> {
  try {
    console.log(
      `[eval] message=${payload.messageId} repo=${payload.repoId} stage=request contexts=${payload.contexts.length} answerChars=${payload.answer.length}`
    );
    const res = await aiClient.post<AiEvalResponse>("/api/v1/eval/score", {
      repo_id: payload.repoId,
      message_id: payload.messageId,
      question: payload.question,
      answer: payload.answer,
      contexts: payload.contexts,
    });

    const overall = Number(
      ((res.data.faithfulness + res.data.answer_relevancy + res.data.context_precision) / 3).toFixed(2)
    );

    console.log(
      `[eval] message=${payload.messageId} repo=${payload.repoId} stage=done overall=${overall} grade=${res.data.overall}`
    );
    return {
      faithfulness: res.data.faithfulness,
      answerRelevancy: res.data.answer_relevancy,
      contextPrecision: res.data.context_precision,
      overall,
      grade: res.data.overall,
    };
  } catch {
    console.log(
      `[eval] message=${payload.messageId} repo=${payload.repoId} stage=fallback contexts=${payload.contexts.length}`
    );
    return fallbackScore(payload.contexts);
  }
}
