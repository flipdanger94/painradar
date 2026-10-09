import { z } from "zod";
import { sourceIds, sourceFields } from "../source-catalog";
import { webhookUrl } from "../webhook-security";
const urls = z
  .array(
    z
      .string()
      .max(2048)
      .refine((value) => {
        try {
          webhookUrl(value);
          return true;
        } catch {
          return false;
        }
      }, "Use a public HTTPS source URL"),
  )
  .max(10);
export const sourceConfigInput = z
  .object({
    id: z.enum(sourceIds.filter((id) => id !== "csv")),
    enabled: z.boolean(),
    config: z
      .object({
        since: z.iso
          .datetime()
          .refine(
            (s) => new Date(s).getTime() <= Date.now(),
            "Backfill date cannot be in the future",
          )
          .optional(),
        pageBudget: z.number().int().min(1).max(10).default(3),
        keywords: z.array(z.string().trim().min(2).max(80)).max(10).optional(),
        repositories: z
          .array(z.string().regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/))
          .max(20)
          .optional(),
        subreddits: z
          .array(z.string().regex(/^[a-zA-Z0-9_]{2,30}$/))
          .max(10)
          .optional(),
        tags: z
          .array(z.string().regex(/^[-+.a-zA-Z0-9#]{1,50}$/))
          .max(10)
          .optional(),
        site: z
          .string()
          .regex(/^[-a-z0-9.]{2,80}$/)
          .optional(),
        projects: z
          .array(
            z
              .string()
              .min(3)
              .max(180)
              .regex(/^[-a-zA-Z0-9_.]+(?:\/[-a-zA-Z0-9_.]+)+$/)
              .refine((p) =>
                p.split("/").every((s) => s !== "." && s !== ".."),
              ),
          )
          .max(20)
          .optional(),
        forums: urls.optional(),
        feeds: urls.optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((d, ctx) => {
    const field = sourceFields[d.id];
    if (
      d.enabled &&
      !((d.config as Record<string, unknown>)[field] as unknown[] | undefined)
        ?.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Configure source scopes before collecting",
        path: ["config", field],
      });
  });
