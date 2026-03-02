import { openai } from "@/lib/openai";
import { scoreRisks, getSummary } from "@/core/scoreEngine";
import { z } from "zod";
import { NextResponse } from "next/server";

const RiskItemSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string(),
  probability: z.number().min(0).max(1),
  impact: z.number().min(0).max(1),
});

const RequestBodySchema = z.object({
  description: z.string().min(1),
  meta: z
    .object({
      duration_weeks: z.number().int().positive().optional(),
      tech_complexity: z.string().optional(),
      cross_team: z.boolean().optional(),
      external_approval: z.boolean().optional(),
    })
    .optional(),
});

const SYSTEM_PROMPT = `你是一个项目风险分析专家。根据用户给出的项目描述，生成恰好 15 条执行风险。
每条风险必须包含：title（简短标题）、description（简要说明）、category（类别，如：进度、技术、资源、外部依赖等）、probability（发生概率 0-1）、impact（影响程度 0-1）。
只输出一个 JSON 对象，且必须包含键 "risks"，值为数组，数组内恰好 15 个对象。不要其他文字。格式示例：
{"risks":[{"title":"...","description":"...","category":"...","probability":0.3,"impact":0.8}, ...]}
共 15 个风险对象。`;

const MAX_TEXT_LENGTH = 25_000;

function sanitizeText(s: string): string {
  const trimmed = s.replace(/\n{2,}/g, "\n\n").trim();
  return trimmed.length > MAX_TEXT_LENGTH ? trimmed.slice(0, MAX_TEXT_LENGTH) : trimmed;
}

function formatSummary(
  top5Titles: string[],
  levelCounts: Record<string, number>
): string {
  const top = top5Titles.length
    ? `Top 5 风险：${top5Titles.join("；")}`
    : "";
  const levels = `等级分布：Critical ${levelCounts.Critical ?? 0}，High ${levelCounts.High ?? 0}，Medium ${levelCounts.Medium ?? 0}，Low ${levelCounts.Low ?? 0}`;
  return [top, levels].filter(Boolean).join("。");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RequestBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "参数无效", details: parsed.error.message },
        { status: 400 }
      );
    }
    const { description, meta } = parsed.data;
    const sanitized = sanitizeText(description);
    if (sanitized.length < 20) {
      return NextResponse.json(
        { error: "输入过短", details: "描述不少于 20 字符" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "未配置 OPENAI_API_KEY" }, { status: 500 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: sanitized },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: "OpenAI 未返回内容" }, { status: 502 });
    }

    let risksJson: unknown;
    try {
      risksJson = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "OpenAI 返回非合法 JSON" }, { status: 502 });
    }

    const array = Array.isArray(risksJson) ? risksJson : (risksJson as { risks?: unknown }).risks;
    if (!Array.isArray(array)) {
      return NextResponse.json({ error: "OpenAI 返回格式中未找到风险数组" }, { status: 502 });
    }

    const risksParse = z.array(RiskItemSchema).safeParse(array);
    if (!risksParse.success) {
      return NextResponse.json(
        { error: "风险数据校验失败", details: risksParse.error.message },
        { status: 502 }
      );
    }
    let riskInputs = risksParse.data;
    if (riskInputs.length !== 15) {
      riskInputs = riskInputs.slice(0, 15);
      while (riskInputs.length < 15) {
        riskInputs.push({
          title: `补充风险 ${riskInputs.length + 1}`,
          description: "由系统补充的占位风险",
          category: "其他",
          probability: 0.3,
          impact: 0.3,
        });
      }
    }

    const scored = scoreRisks(riskInputs, {
      duration_weeks: meta?.duration_weeks,
      tech_complexity: meta?.tech_complexity,
    });

    const { top5Titles, levelCounts } = getSummary(scored);
    const summary = formatSummary(top5Titles, levelCounts);

    const risks = scored
      .sort((a, b) => b.score - a.score)
      .map((r) => ({
        title: r.title,
        description: r.description,
        category: r.category,
        probability: r.probability,
        impact: r.impact,
        score: r.score,
        level: r.level,
      }));

    return NextResponse.json({ risks, summary });
  } catch (e) {
    console.error("analyze error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "分析失败" },
      { status: 500 }
    );
  }
}
