import "dotenv/config";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../src/db";
import { detectLanguage } from "../src/lib/detect-language";

async function main() {
  // Explicit, bounded maintenance command. Dry run by default; no raw text is printed.
  const args: Record<string, unknown> = {};
  for (const arg of process.argv.slice(2)) {
    if (arg === "--apply") args.apply = true;
    else if (arg.startsWith("--limit=")) args.limit = arg.slice(8);
    else if (arg.startsWith("--after=")) args.after = arg.slice(8);
    else
      throw new Error(
        "Use --limit=1..200, --after=UUID and optionally --apply",
      );
  }
  const options = z
    .object({
      limit: z.coerce.number().int().min(1).max(200).default(200),
      after: z.uuid().optional(),
      apply: z.boolean().default(false),
    })
    .parse(args);
  const result = await db().execute(
    sql`select id,left(content,12000) as content,language,content_hash from raw_signals ${options.after ? sql`where id>${options.after}::uuid` : sql``} order by id limit ${options.limit + 1}`,
  );
  const page = result.rows.slice(0, options.limit);
  const proposals = page.flatMap((row) => {
    const next = detectLanguage(String(row.content));
    return next === row.language
      ? []
      : [
          {
            id: String(row.id),
            before: String(row.language),
            after: next,
            hash: String(row.content_hash),
          },
        ];
  });
  let updated = 0;
  if (options.apply && proposals.length) {
    const changed = await db().execute(
      sql`with proposed as (select * from jsonb_to_recordset(${JSON.stringify(proposals)}::jsonb) as p(id uuid,before text,after text,hash text)) update raw_signals s set language=p.after from proposed p where s.id=p.id and s.language=p.before and s.content_hash=p.hash returning s.id`,
    );
    updated = changed.rows.length;
  }
  console.log(
    JSON.stringify({
      dryRun: !options.apply,
      scanned: page.length,
      proposed: proposals.length,
      updated,
      skippedConcurrent: options.apply ? proposals.length - updated : 0,
      nextAfter:
        result.rows.length > options.limit ? String(page.at(-1)!.id) : null,
    }),
  );
}

export const completion = main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
