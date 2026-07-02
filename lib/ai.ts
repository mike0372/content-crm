import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "./supabase";

// ============================================================================
// Central Claude config + the single choke point for every AI call.
//
// Why this exists:
//  - Model IDs live HERE, not hardcoded across 7 route files. When a model is
//    deprecated, change one line (or set the env override) instead of editing
//    every route under pressure.
//  - Every call is logged (tokens + estimated cost) to `ai_usage` so the
//    dashboard can show spend, and an optional monthly budget can hard-stop
//    runaway cost.
// ============================================================================

// Override per-environment with ANTHROPIC_MODEL_FAST / ANTHROPIC_MODEL_SMART.
export const MODELS = {
  fast: process.env.ANTHROPIC_MODEL_FAST ?? "claude-haiku-4-5-20251001",
  smart: process.env.ANTHROPIC_MODEL_SMART ?? "claude-sonnet-4-6",
} as const;

export type ModelTier = keyof typeof MODELS;

// Estimated USD price per 1M tokens — used only for the cost panel + budget
// cap, not billing. Approximate published rates; adjust if pricing changes.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
};

function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? PRICING["claude-sonnet-4-6"];
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function monthlyBudgetUsd(): number | null {
  const raw = process.env.AI_MONTHLY_USD_BUDGET;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Sum this month's spend. Fails soft (returns 0) so a missing table or read
// error never blocks a legitimate AI call.
async function monthSpendUsd(): Promise<number> {
  try {
    const { data, error } = await getSupabase()
      .from("ai_usage")
      .select("cost_usd")
      .gte("created_at", monthStartIso());
    if (error || !data) return 0;
    return data.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  } catch {
    return 0;
  }
}

async function logUsage(
  route: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  try {
    await getSupabase().from("ai_usage").insert({
      route,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: estimateCostUsd(model, inputTokens, outputTokens),
    });
  } catch {
    /* never fail the request because usage logging failed */
  }
}

// Thrown by createMessage() when the monthly budget is reached. Routes surface
// it through their existing try/catch as a 5xx with a clear message.
export class AiBudgetError extends Error {
  constructor(public readonly budgetUsd: number, public readonly spentUsd: number) {
    super(
      `Monthly AI budget reached ($${spentUsd.toFixed(2)} of $${budgetUsd.toFixed(
        2
      )}). Raise AI_MONTHLY_USD_BUDGET or wait for next month.`
    );
    this.name = "AiBudgetError";
  }
}

let cachedClient: Anthropic | null = null;
function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  if (!cachedClient) cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

type CreateParams = Omit<Anthropic.MessageCreateParamsNonStreaming, "model">;

// Strip unpaired UTF-16 surrogates (e.g. an emoji cut in half by .slice on an
// Instagram caption or title). A lone surrogate makes the request body invalid
// JSON and the API rejects the whole call with a 400 ("no low surrogate").
// Applied centrally so every route that embeds DB/user text is covered.
function wellFormed(s: string): string {
  return s.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    ""
  );
}

function sanitizeParams(params: CreateParams): CreateParams {
  return {
    ...params,
    system: typeof params.system === "string" ? wellFormed(params.system) : params.system,
    messages: params.messages.map((m) => ({
      ...m,
      content: typeof m.content === "string" ? wellFormed(m.content) : m.content,
    })),
  };
}

// Every Claude call funnels through here. `route` attributes the spend for the
// cost panel; `tier` selects the model from central config above.
export async function createMessage(
  params: CreateParams,
  opts: { route: string; tier: ModelTier }
): Promise<Anthropic.Message> {
  const budget = monthlyBudgetUsd();
  if (budget !== null) {
    const spent = await monthSpendUsd();
    if (spent >= budget) throw new AiBudgetError(budget, spent);
  }

  const model = MODELS[opts.tier];
  const res = await client().messages.create({ ...sanitizeParams(params), model });
  await logUsage(opts.route, model, res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0);
  return res;
}

// ---- Cost panel ------------------------------------------------------------

export interface AiUsageSummary {
  month: string; // YYYY-MM
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  calls: number;
  byRoute: { route: string; costUsd: number; calls: number }[];
  budgetUsd: number | null;
  overBudget: boolean;
}

export async function getMonthlyAiUsage(): Promise<AiUsageSummary> {
  const month = monthStartIso().slice(0, 7);
  const budgetUsd = monthlyBudgetUsd();
  const empty: AiUsageSummary = {
    month,
    costUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    calls: 0,
    byRoute: [],
    budgetUsd,
    overBudget: false,
  };

  try {
    const { data, error } = await getSupabase()
      .from("ai_usage")
      .select("route, input_tokens, output_tokens, cost_usd")
      .gte("created_at", monthStartIso());
    if (error || !data) return empty;

    let costUsd = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    const routeMap = new Map<string, { costUsd: number; calls: number }>();

    for (const r of data) {
      const c = Number(r.cost_usd ?? 0);
      costUsd += c;
      inputTokens += Number(r.input_tokens ?? 0);
      outputTokens += Number(r.output_tokens ?? 0);
      const cur = routeMap.get(r.route) ?? { costUsd: 0, calls: 0 };
      cur.costUsd += c;
      cur.calls += 1;
      routeMap.set(r.route, cur);
    }

    const byRoute = [...routeMap.entries()]
      .map(([route, v]) => ({ route, ...v }))
      .sort((a, b) => b.costUsd - a.costUsd);

    return {
      month,
      costUsd,
      inputTokens,
      outputTokens,
      calls: data.length,
      byRoute,
      budgetUsd,
      overBudget: budgetUsd !== null && costUsd >= budgetUsd,
    };
  } catch {
    return empty;
  }
}
