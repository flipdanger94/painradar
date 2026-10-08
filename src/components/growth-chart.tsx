export function GrowthChart({
  rows,
}: {
  rows: { day: string; mentions: number; score: number }[];
}) {
  if (rows.length < 2)
    return <p className="text-small">Not enough historical snapshots yet.</p>;
  const max = Math.max(...rows.map((r) => r.mentions), 1);
  const path = rows
    .map(
      (r, i) =>
        `${i ? "L" : "M"}${20 + (i / (rows.length - 1)) * 560},${110 - (r.mentions / max) * 90}`,
    )
    .join(" ");
  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox="0 0 600 140"
        className="graph"
        role="img"
        aria-label="Observed mentions over time"
      >
        <path d={path} />
        <text x="20" y="135">
          {rows[0].day}
        </text>
        <text x="490" y="135">
          {rows.at(-1)?.day}
        </text>
      </svg>
      <figcaption className="text-small muted">
        Daily observed mentions · {rows.length} snapshots
      </figcaption>
    </figure>
  );
}
