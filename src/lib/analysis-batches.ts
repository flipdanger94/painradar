import { embeddingModel, freeTier } from "./gemini";
import { sql } from "drizzle-orm";
import { db } from "@/db";
export const PIPELINE_LIMITS = {
  embeddings: freeTier() ? 40 : 200,
  seeds: freeTier() ? 20 : 200,
  analysis: freeTier() ? 20 : 200,
  publicationClaims: 5,
  publicationPages: 20,
  publicationPageSize: 100,
} as const;
export async function planAnalysisBatch() {
  await db().execute(
    sql`insert into pipeline_cursors(id) values('analysis') on conflict do nothing`,
  );
  const progress = await db().execute(
    sql`select cursor from pipeline_cursors where id='analysis'`,
  );
  const previous = progress.rows[0]?.cursor
    ? String(progress.rows[0].cursor)
    : null;
  let rows = await db().execute(
    sql`select id from pain_clusters where (${previous}::uuid is null or id>${previous}::uuid) order by id limit ${PIPELINE_LIMITS.analysis}`,
  );
  if (!rows.rows.length && previous)
    rows = await db().execute(
      sql`select id from pain_clusters order by id limit ${PIPELINE_LIMITS.analysis}`,
    );
  const ids = rows.rows.map((r) => String(r.id));
  return { previous, ids, next: ids.at(-1) || null };
}
export async function commitAnalysisBatch(
  previous: string | null,
  next: string | null,
) {
  const r = await db().execute(
    sql`update pipeline_cursors set cursor=${next}::uuid,updated_at=now() where id='analysis' and cursor is not distinct from ${previous}::uuid returning id`,
  );
  return r.rows.length > 0;
}

// Rotate unmatched seeds so one sparse group cannot starve newer evidence.
export async function planGroupingBatch() {
  await db().execute(
    sql`insert into pipeline_cursors(id) values('grouping') on conflict do nothing`,
  );
  const progress = await db().execute(
    sql`select cursor from pipeline_cursors where id='grouping'`,
  );
  const previous = progress.rows[0]?.cursor
    ? String(progress.rows[0].cursor)
    : null;
  let rows = await db().execute(
    sql`select id from raw_signals where processed_at is null and duplicate_of is null and retired_at is null and embedding is not null and embedding_model=${embeddingModel()} and (${previous}::uuid is null or id>${previous}::uuid) order by id limit ${PIPELINE_LIMITS.seeds}`,
  );
  if (!rows.rows.length && previous)
    rows = await db().execute(
      sql`select id from raw_signals where processed_at is null and duplicate_of is null and retired_at is null and embedding is not null and embedding_model=${embeddingModel()} order by id limit ${PIPELINE_LIMITS.seeds}`,
    );
  const ids = rows.rows.map((r) => String(r.id));
  return { previous, ids, next: ids.at(-1) || null };
}
export async function commitGroupingBatch(
  previous: string | null,
  next: string | null,
) {
  const result = await db().execute(
    sql`update pipeline_cursors set cursor=${next}::uuid,updated_at=now() where id='grouping' and cursor is not distinct from ${previous}::uuid returning id`,
  );
  return result.rows.length > 0;
}
