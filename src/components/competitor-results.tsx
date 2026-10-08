import { marketGap, solutionFitSchema } from "@/lib/market-gap";

export function MarketGap({ results }: { results: Record<string, unknown>[] }) {
  const gap = marketGap(results);
  return (
    <div>
      <span className="badge">AI INFERENCE · RESEARCH SAMPLE</span>
      <p>
        {gap.score === null
          ? "Not enough data. At least two distinct provider domains with cited comparisons are required."
          : `Unmet-need estimate: ${gap.score}/100 · higher means less coverage of this pain.`}
      </p>
      <p>
        {gap.assessed} assessed provider domains · {gap.unknown} unknown.
      </p>
      <p className="text-small">
        Full coverage = 0, partial = 50, explicitly unmet = 100; average across
        assessed domains. Unknowns are excluded. Multiple pages from one domain
        use its strongest coverage. This sample may miss solutions and does not
        measure market size or change the opportunity score.
      </p>
    </div>
  );
}

export function CompetitorResults({
  results,
  displayedEvidenceIds,
}: {
  results: Record<string, unknown>[];
  displayedEvidenceIds: string[];
}) {
  type Claim = { text: string; sourceUrls: string[] };
  function renderClaim(c: Claim | null) {
    return c ? (
      <div>
        <p>{c.text}</p>
        <div className="card-meta">
          {c.sourceUrls.map((url) => (
            <a
              className="text-link"
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Source ↗
            </a>
          ))}
        </div>
      </div>
    ) : (
      <p>Not enough data.</p>
    );
  }
  return (
    <div>
      {results.length ? (
        results.map((r, i) => {
          const fit = solutionFitSchema.safeParse(r.solutionFit);
          return (
            <article key={i} className="section-rule">
              <h3>
                <a
                  href={String(r.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {String(r.name)} ↗
                </a>
              </h3>
              {renderClaim(r.description as Claim)}
              <h3 className="text-small">Pricing</h3>
              {renderClaim(r.pricing as Claim | null)}
              <h3 className="text-small">Positioning</h3>
              {renderClaim(r.positioning as Claim | null)}
              <h3 className="text-small">Fit for this pain · AI inference</h3>
              {fit.success ? (
                <div>
                  <p>Coverage: {fit.data.coverage}</p>
                  {renderClaim({
                    text: fit.data.rationale,
                    sourceUrls: fit.data.sourceUrls,
                  })}
                  <div className="card-meta">
                    {fit.data.evidenceIds.map((id) =>
                      displayedEvidenceIds.includes(id) ? (
                        <a
                          className="text-link"
                          key={id}
                          href={"#signal-" + id}
                        >
                          Pain evidence ↗
                        </a>
                      ) : (
                        <span key={id}>
                          Referenced signal is outside the displayed evidence.
                        </span>
                      ),
                    )}
                  </div>
                </div>
              ) : (
                <p>
                  Not assessed. Run research to compare this solution with the
                  pain.
                </p>
              )}
              <h3 className="text-small">Reported advantages</h3>
              {Array.isArray(r.advantages) && r.advantages.length ? (
                r.advantages.map((c, i) => (
                  <div key={i}>{renderClaim(c as Claim)}</div>
                ))
              ) : (
                <p>Not enough data.</p>
              )}
              <h3 className="text-small">Reported complaints</h3>
              {Array.isArray(r.complaints) && r.complaints.length ? (
                r.complaints.map((c, i) => (
                  <div key={i}>{renderClaim(c as Claim)}</div>
                ))
              ) : (
                <p>Not enough data.</p>
              )}
            </article>
          );
        })
      ) : (
        <p>Not enough data. No source-backed competitors were found.</p>
      )}
    </div>
  );
}
