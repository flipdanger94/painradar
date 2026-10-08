export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function brandedReport(
  brand: { name: string; color: string; client: string },
  report: {
    period: string;
    startDay: string;
    endDay: string;
    content: Record<string, unknown>[];
  },
) {
  const color = /^#[0-9a-f]{6}$/i.test(brand.color) ? brand.color : "#555555";
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(brand.name)} · Client report</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;color:#222}h1{color:${color}}article{border-top:1px solid #ddd;padding:24px 0}.label{font-size:13px;color:#555}@media print{body{margin:0;max-width:none}article{break-inside:avoid}}</style><h1>${escapeHtml(brand.name)}</h1><h2>${escapeHtml(brand.client)}</h2><p>${escapeHtml(report.period)} · ${escapeHtml(report.startDay)} – ${escapeHtml(report.endDay)}</p><p class="label">Up to 500 saved opportunities, ranked by score. Titles and summaries may be abbreviated. Evidence-based opportunity snapshots. Scores are observations, not revenue forecasts. Summaries are AI inferences and require validation.</p>${report.content.map((o) => `<article><h2>${escapeHtml(o.title)}</h2><p>${escapeHtml(o.summary)}</p><p>Score: ${escapeHtml(o.score)} /100 · Mentions: ${escapeHtml(o.mentions)} · Confidence: ${escapeHtml(o.confidence || "Not recorded")}</p><p class="label">Opportunity ID: ${escapeHtml(o.id)}</p></article>`).join("") || "<p>No saved opportunities were present in this report snapshot.</p>"}</html>`;
}
