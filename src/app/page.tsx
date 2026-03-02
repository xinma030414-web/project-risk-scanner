"use client";

import { useState, useEffect } from "react";

type Risk = {
  id: string;
  title: string;
  description: string;
  category: string;
  probability: number;
  impact: number;
  score: number;
  level: string;
};

type Project = {
  id: string;
  description: string;
  duration_weeks: number | null;
  tech_complexity: string | null;
  cross_team: boolean | null;
  external_approval: boolean | null;
  created_at: string;
};

export default function Home() {
  const [description, setDescription] = useState("");
  const [durationWeeks, setDurationWeeks] = useState<string>("");
  const [techComplexity, setTechComplexity] = useState("");
  const [crossTeam, setCrossTeam] = useState<boolean | "">("");
  const [externalApproval, setExternalApproval] = useState<boolean | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);

  const fetchLatest = async () => {
    try {
      const res = await fetch("/api/latest");
      const data = await res.json();
      if (data.project) {
        setProject(data.project);
        setRisks(data.risks ?? []);
      } else {
        setProject(null);
        setRisks([]);
      }
    } catch {
      setProject(null);
      setRisks([]);
    }
  };

  useEffect(() => {
    fetchLatest();
  }, []);

  const handleAnalyze = async () => {
    if (!description.trim() && !file) {
      setError("请填写项目描述和/或上传 .pdf / .docx 文件");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      let textToSend = description.trim();
      if (file) {
        const name = file.name.toLowerCase();
        if (name.endsWith(".pdf")) {
          const { getTextFromPdf } = await import("@/lib/extractClient");
          textToSend = [textToSend, await getTextFromPdf(file)].filter(Boolean).join("\n\n");
        } else if (name.endsWith(".docx")) {
          const { getTextFromDocx } = await import("@/lib/docxClient");
          textToSend = [textToSend, await getTextFromDocx(file)].filter(Boolean).join("\n\n");
        } else {
          setError("仅支持 .pdf 和 .docx 文件");
          setLoading(false);
          return;
        }
      }
      if (textToSend.length < 20) {
        setError("合并后的内容过短（至少 20 字符），请补充描述或上传有效文件");
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("description", textToSend);
      if (durationWeeks) formData.append("duration_weeks", durationWeeks);
      if (techComplexity) formData.append("tech_complexity", techComplexity);
      if (crossTeam !== "") formData.append("cross_team", String(crossTeam));
      if (externalApproval !== "") formData.append("external_approval", String(externalApproval));

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.details ? `${data.error}: ${data.details}` : (data.error ?? "分析失败");
        setError(msg);
        return;
      }
      setProject(data.project);
      setRisks(data.risks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  const top5 = risks.slice(0, 5);
  const matrix = (() => {
    const lowP_lowI: Risk[] = [];
    const highP_lowI: Risk[] = [];
    const lowP_highI: Risk[] = [];
    const highP_highI: Risk[] = [];
    for (const r of risks) {
      const highP = r.probability >= 0.5;
      const highI = r.impact >= 0.5;
      if (!highP && !highI) lowP_lowI.push(r);
      else if (highP && !highI) highP_lowI.push(r);
      else if (!highP && highI) lowP_highI.push(r);
      else highP_highI.push(r);
    }
    return { lowP_lowI, highP_lowI, lowP_highI, highP_highI };
  })();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="max-w-6xl mx-auto py-10 px-4">
        <h1 className="text-2xl font-bold mb-2">
          Project Risk Scanner – AI Execution Risk Analysis
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          输入项目描述，AI 生成 15 条风险，本地规则引擎打分并持久化；刷新后仍可查看最近一次结果。
        </p>

        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-medium mb-1">项目描述 *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：为期 6 个月的跨部门 CRM 系统改造，依赖外部审批与第三方接口..."
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 min-h-[120px]"
              rows={4}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">上传文件（可选）</label>
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-zinc-600 dark:text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-200 dark:file:bg-zinc-700 file:px-4 file:py-2 file:font-medium"
            />
            {file && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                已选择：{file.name}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">周期（周）</label>
              <input
                type="number"
                min={1}
                value={durationWeeks}
                onChange={(e) => setDurationWeeks(e.target.value)}
                placeholder="可选"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">技术复杂度</label>
              <input
                type="text"
                value={techComplexity}
                onChange={(e) => setTechComplexity(e.target.value)}
                placeholder="如：高/中/低"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">跨团队</label>
              <select
                value={crossTeam === "" ? "" : crossTeam ? "yes" : "no"}
                onChange={(e) =>
                  setCrossTeam(e.target.value === "" ? "" : e.target.value === "yes")
                }
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2"
              >
                <option value="">可选</option>
                <option value="yes">是</option>
                <option value="no">否</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">需外部审批</label>
              <select
                value={externalApproval === "" ? "" : externalApproval ? "yes" : "no"}
                onChange={(e) =>
                  setExternalApproval(e.target.value === "" ? "" : e.target.value === "yes")
                }
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2"
              >
                <option value="">可选</option>
                <option value="yes">是</option>
                <option value="no">否</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={loading}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 font-medium hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "分析中…" : "Analyze"}
            </button>
            {error && <span className="text-red-600 dark:text-red-400 text-sm">{error}</span>}
          </div>
        </div>

        {project && (
          <div className="space-y-8">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              最近分析：{new Date(project.created_at).toLocaleString()}
            </p>

            <section>
              <h2 className="text-lg font-semibold mb-3">Top 5 风险</h2>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-100 dark:bg-zinc-800">
                      <th className="text-left p-3">#</th>
                      <th className="text-left p-3">标题</th>
                      <th className="text-left p-3">类别</th>
                      <th className="text-left p-3">概率</th>
                      <th className="text-left p-3">影响</th>
                      <th className="text-left p-3">得分</th>
                      <th className="text-left p-3">等级</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top5.map((r, i) => (
                      <tr key={r.id} className="border-t border-zinc-200 dark:border-zinc-700">
                        <td className="p-3">{i + 1}</td>
                        <td className="p-3">{r.title}</td>
                        <td className="p-3">{r.category}</td>
                        <td className="p-3">{r.probability.toFixed(2)}</td>
                        <td className="p-3">{r.impact.toFixed(2)}</td>
                        <td className="p-3">{r.score.toFixed(2)}</td>
                        <td className="p-3">{r.level}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">2×2 风险矩阵</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                横轴：概率（低 &lt; 0.5 / 高 ≥ 0.5），纵轴：影响（低 / 高）
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-2xl">
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 bg-amber-50 dark:bg-amber-950/30">
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                    低概率 · 低影响
                  </div>
                  <ul className="text-sm space-y-1">
                    {matrix.lowP_lowI.map((r) => (
                      <li key={r.id}>{r.title}</li>
                    ))}
                    {matrix.lowP_lowI.length === 0 && <li className="text-zinc-400">无</li>}
                  </ul>
                </div>
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 bg-orange-50 dark:bg-orange-950/30">
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                    高概率 · 低影响
                  </div>
                  <ul className="text-sm space-y-1">
                    {matrix.highP_lowI.map((r) => (
                      <li key={r.id}>{r.title}</li>
                    ))}
                    {matrix.highP_lowI.length === 0 && <li className="text-zinc-400">无</li>}
                  </ul>
                </div>
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 bg-orange-50 dark:bg-orange-950/30">
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                    低概率 · 高影响
                  </div>
                  <ul className="text-sm space-y-1">
                    {matrix.lowP_highI.map((r) => (
                      <li key={r.id}>{r.title}</li>
                    ))}
                    {matrix.lowP_highI.length === 0 && <li className="text-zinc-400">无</li>}
                  </ul>
                </div>
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 bg-red-50 dark:bg-red-950/30">
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                    高概率 · 高影响
                  </div>
                  <ul className="text-sm space-y-1">
                    {matrix.highP_highI.map((r) => (
                      <li key={r.id}>{r.title}</li>
                    ))}
                    {matrix.highP_highI.length === 0 && <li className="text-zinc-400">无</li>}
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">全部 15 条风险</h2>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-100 dark:bg-zinc-800">
                      <th className="text-left p-3">标题</th>
                      <th className="text-left p-3">描述</th>
                      <th className="text-left p-3">类别</th>
                      <th className="text-left p-3">概率</th>
                      <th className="text-left p-3">影响</th>
                      <th className="text-left p-3">得分</th>
                      <th className="text-left p-3">等级</th>
                    </tr>
                  </thead>
                  <tbody>
                    {risks.map((r) => (
                      <tr
                        key={r.id}
                        className="border-t border-zinc-200 dark:border-zinc-700"
                      >
                        <td className="p-3 font-medium">{r.title}</td>
                        <td className="p-3 max-w-xs truncate">{r.description}</td>
                        <td className="p-3">{r.category}</td>
                        <td className="p-3">{r.probability.toFixed(2)}</td>
                        <td className="p-3">{r.impact.toFixed(2)}</td>
                        <td className="p-3">{r.score.toFixed(2)}</td>
                        <td className="p-3">{r.level}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {!project && !loading && (
          <p className="text-zinc-500 dark:text-zinc-400">
            暂无分析结果，输入项目描述并点击 Analyze 开始。
          </p>
        )}
      </div>
    </div>
  );
}
