import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const project = await prisma.project.findFirst({
      orderBy: { created_at: "desc" },
      include: {
        risks: { orderBy: { score: "desc" } },
      },
    });
    if (!project) {
      return NextResponse.json({ project: null, risks: [] });
    }
    return NextResponse.json({
      project: {
        id: project.id,
        description: project.description,
        duration_weeks: project.duration_weeks,
        tech_complexity: project.tech_complexity,
        cross_team: project.cross_team,
        external_approval: project.external_approval,
        created_at: project.created_at,
      },
      risks: project.risks,
    });
  } catch (e) {
    console.error("latest error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "获取失败" },
      { status: 500 }
    );
  }
}
