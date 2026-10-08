import { describe, expect, it } from "vitest";
import { locales, messages, translate, validLocale } from "@/lib/i18n/messages";
describe("interface languages", () => {
  it("supports all seven requested languages and defaults safely", () => {
    expect(locales).toEqual(["en", "es", "de", "pt", "ja", "zh", "ru"]);
    expect(validLocale("ru")).toBe("ru");
    expect(validLocale("unknown")).toBe("en");
    expect(validLocale(undefined)).toBe("en");
  });
  it("has a nonempty translation in every language for each registered phrase", () => {
    for (const [key, values] of Object.entries(messages)) {
      expect(values.en).toBe(key);
      for (const locale of locales)
        expect(values[locale].trim().length).toBeGreaterThan(0);
    }
    expect(translate("ru", "Collection monitor")).not.toBe(
      "Collection monitor",
    );
    expect(translate("ja", "Latest signals")).not.toBe("Latest signals");
  });
  it("preserves source content that is not interface text", () => {
    expect(translate("ru", "An original source issue #4381")).toBe(
      "An original source issue #4381",
    );
  });
});
