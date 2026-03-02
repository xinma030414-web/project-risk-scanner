import { prisma } from "@/lib/db";
import { openai } from "@/lib/openai";
import { scoreRisks } from "@/core/scoreEngine";
import { z } from "zod";
import { NextResponse } from "next/server";

const RiskItemSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string(),
  probability: z.number().min(0).max(1),
  impact: z.number().min(0).max(1),
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

// PDF/DOCX 解析仅在前端进行，后端只接收已提取的纯文本，不使用 pdfjs
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const description = (formData.get("description") as string | null)?.trim() ?? "";
    const duration_weeksRaw = formData.get("duration_weeks");
    const tech_complexity = (formData.get("tech_complexity") as string | null)?.trim() ?? "";
    const cross_teamRaw = formData.get("cross_team");
    const external_approvalRaw = formData.get("external_approval");

    let duration_weeks: number | undefined;
    if (duration_weeksRaw != null && duration_weeksRaw !== "") {
      const n = Number(duration_weeksRaw);
      if (Number.isInteger(n) && n > 0) duration_weeks = n;
    }
    const cross_team =
      cross_teamRaw === "true" ? true : cross_teamRaw === "false" ? false : undefined;
    const external_approval =
      external_approvalRaw === "true" ? true : external_approvalRaw === "false" ? false : undefined;

    const sanitized = sanitizeText(description);
    if (sanitized.length < 20) {
      return NextResponse.json(
        {
          error: "输入过短",
          details: "请填写项目描述和/或上传 .pdf / .docx 文件，且合并后不少于 20 字符",
        },
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
      duration_weeks: duration_weeks ?? undefined,
      tech_complexity: tech_complexity || undefined,
    });

    const project = await prisma.project.create({
      data: {
        description: sanitized,
        duration_weeks: duration_weeks ?? null,
        tech_complexity: tech_complexity || null,
        cross_team: cross_team ?? null,
        external_approval: external_approval ?? null,
      },
    });

    await prisma.risk.createMany({
      data: scored.map((r) => ({
        projectId: project.id,
        title: r.title,
        description: r.description,
        category: r.category,
        probability: r.probability,
        impact: r.impact,
        score: r.score,
        level: r.level,
      })),
    });

    const risks = await prisma.risk.findMany({
      where: { projectId: project.id },
      orderBy: { score: "desc" },
    });

    return NextResponse.json({ project, risks });
  } catch (e) {
    console.error("analyze error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "分析失败" },
      { status: 500 }
    );
  }
}
