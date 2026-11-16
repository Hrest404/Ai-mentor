import "server-only";
import { GoogleGenAI, type Schema } from "@google/genai";
import type { ZodType } from "zod";
import { aiAuth, aiBusy, aiBadResponse, aiUnavailable } from "./errors";
import { runWithFallback } from "./fallback";

/**
 * Модели подобраны по проверке живого API: версии 2.5 для новых ключей закрыты (404),
 * часть 3.x временно отвечает 503, поэтому у каждой роли цепочка запасных.
 * Переопределяется переменными GEMINI_MODEL_FAST / GEMINI_MODEL_CHAT / GEMINI_MODEL_STRONG (список через запятую).
 */
export type Tier = "fast" | "chat" | "strong";

const DEFAULTS: Record<Tier, string[]> = {
  fast: ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.1-flash-lite"],
  // 3.5-flash отвечает 503 или молчит 20-35 с, поэтому первой идёт lite (первый фрагмент за ~1 с).
  chat: ["gemini-3.5-flash-lite", "gemini-3.5-flash"],
  // 3.6-flash при проверке отвечала 40-60 с или молчала до таймаута, поэтому первой идёт lite (около 2 с), сильная только запасной.
  // Когда нагрузка на API спадёт, вернуть сильную модель первой: GEMINI_MODEL_STRONG=gemini-3.6-flash,gemini-3.5-flash-lite.
  strong: ["gemini-3.5-flash-lite", "gemini-3.6-flash"],
};

export function modelsFor(tier: Tier, env: Record<string, string | undefined> = process.env): string[] {
  const raw = env[`GEMINI_MODEL_${tier.toUpperCase()}`];
  const custom = raw
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return custom && custom.length > 0 ? custom : DEFAULTS[tier];
}

export const isAiConfigured = () => Boolean(process.env.GEMINI_API_KEY?.trim());

let cached: { key: string; ai: GoogleGenAI } | null = null;
function client(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw aiUnavailable();
  if (!cached || cached.key !== key) cached = { key, ai: new GoogleGenAI({ apiKey: key }) };
  return cached.ai;
}

/**
 * «Размышления» моделей съедают лимит выходных токенов и тормозят ответ: где можно, выключаем.
 * Модели flash-lite этот параметр не принимают (ответ 400), им он не нужен.
 */
function thinkingFor(model: string) {
  return /flash-lite/.test(model) ? {} : { thinkingConfig: { thinkingBudget: 0 } };
}

export interface JsonRequest<T> {
  tier: Tier;
  system: string;
  prompt: string;
  /** Схема ответа для Gemini. */
  schema: Schema;
  /** Строгая проверка того, что вернула модель. */
  validate: ZodType<T>;
  temperature?: number;
  timeoutMs?: number;
  maxOutputTokens?: number;
  /** Общий срок на всю цепочку моделей, мс (по умолчанию 30 с). */
  deadlineMs?: number;
  /** Повторов на одну модель при временном сбое (по умолчанию 1). */
  retriesPerModel?: number;
}

/** Один структурированный ответ: JSON по схеме, проверенный zod. */
export async function generateJson<T>(req: JsonRequest<T>): Promise<{ data: T; model: string }> {
  const ai = client();
  const { value, model } = await runWithFallback(
    modelsFor(req.tier),
    async (model) => {
      const res = await ai.models.generateContent({
        model,
        contents: req.prompt,
        config: {
          systemInstruction: req.system,
          responseMimeType: "application/json",
          responseSchema: req.schema,
          temperature: req.temperature ?? 0.3,
          maxOutputTokens: req.maxOutputTokens ?? 2048,
          abortSignal: AbortSignal.timeout(req.timeoutMs ?? 15_000),
          ...thinkingFor(model),
        },
      });
      let json: unknown;
      try {
        json = JSON.parse(res.text ?? "");
      } catch (e) {
        throw aiBadResponse("Модель вернула не JSON", e);
      }
      const checked = req.validate.safeParse(json);
      if (!checked.success) throw aiBadResponse("Ответ модели не прошёл проверку", checked.error);
      return checked.data;
    },
    { deadlineMs: req.deadlineMs ?? 30_000, retriesPerModel: req.retriesPerModel },
  );
  return { data: value, model };
}

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

export interface StreamRequest {
  system: string;
  turns: ChatTurn[];
  temperature?: number;
  maxOutputTokens?: number;
  /** Сколько ждать первый фрагмент, мс. */
  firstChunkTimeoutMs?: number;
  /** Сигнал отмены (клиент закрыл соединение). */
  signal?: AbortSignal;
}

/**
 * Потоковый ответ чата. Запасная модель выбирается только до первого фрагмента:
 * если поток уже пошёл, обрыв прокидывается наверх, чтобы не склеивать ответы разных моделей.
 */
export async function* streamChat(req: StreamRequest): AsyncGenerator<{ text: string; model: string }> {
  const ai = client();
  const models = modelsFor("chat");
  let lastErr: unknown;

  for (const model of models) {
    const timeout = AbortSignal.timeout(req.firstChunkTimeoutMs ?? 20_000);
    const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;
    // Ответ уже пошёл к клиенту: после этого запасную модель брать нельзя.
    let started = false;
    try {
      const stream = (await ai.models.generateContentStream({
        model,
        contents: req.turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
        config: {
          systemInstruction: req.system,
          temperature: req.temperature ?? 0.7,
          maxOutputTokens: req.maxOutputTokens ?? 600,
          abortSignal: signal,
          ...thinkingFor(model),
        },
      })) as AsyncIterable<{ text?: string }>;

      for await (const chunk of stream) {
        if (!chunk.text) continue;
        started = true;
        yield { text: chunk.text, model };
      }
      if (started) return;
      lastErr = aiBadResponse("Пустой ответ модели");
    } catch (err) {
      if (started || req.signal?.aborted) throw err;
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) throw aiAuth(err);
      lastErr = err;
    }
  }
  throw aiBusy(lastErr);
}
