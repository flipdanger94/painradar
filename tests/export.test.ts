import { it, expect } from "vitest";
import { csvCell } from "@/lib/csv";
it("escapes CSV quotes and rejects spreadsheet formula execution", () => {
  expect(csvCell('a"b')).toBe('"a""b"');
  expect(csvCell('=HYPERLINK("https://example.test")')).toBe(
    '"\'=HYPERLINK(""https://example.test"")"',
  );
  expect(csvCell("+cmd")).toBe('"\'+cmd"');
  expect(csvCell(null)).toBe('""');
});
