import { describe, expect, it } from "vitest";
import { language } from "@/lib/sources/types";
import { apiQuerySchema } from "@/lib/api-pagination";
import { canonicalIndustry, industryMatches } from "@/lib/taxonomy";
const samples = {
  en: "I cannot deploy my application because the build fails every time and the error messages do not explain what went wrong.",
  ru: "Я не могу запустить приложение, потому что сборка постоянно падает, а сообщения об ошибках не помогают найти причину.",
  kk: "Менің қосымшам дұрыс жұмыс істемейді. Құжаттарды жүктеу кезінде қате шығады және бұл мәселені шешу үшін көмек қажет.",
  uk: "Мені потрібна допомога з налаштуванням програми, тому що повідомлення про помилки не пояснюють причину проблеми.",
  es: "No puedo utilizar la aplicación porque siempre aparece un error y necesito encontrar una solución para este problema.",
  zh: "我无法使用这个应用程序，因为每次上传文件的时候都会出现错误。我需要一个能够自动处理这些文件的工具。",
};
describe("conservative multilingual signal detection", () => {
  for (const [code, text] of Object.entries(samples))
    it(`detects ${code} in a full pain statement`, () =>
      expect(language(text)).toBe(code));
  it("does not label short text, URLs, numbers or code as English", () => {
    for (const text of [
      "Hello world",
      "Привет",
      "12345 😀",
      "https://example.test/a/very/long/path/that/is/not/natural/language",
      "```javascript\nconst longIdentifier = 'arbitrary repeated code not source prose';\n```",
    ])
      expect(language(text)).toBe("und");
  });
  it("leaves substantial mixed scripts undetermined", () =>
    expect(language(samples.en + " " + samples.ru)).toBe("und"));
  it("does not force an unsupported language into the available catalog", () => {
    expect(
      language(
        "Alle menslike wesens word vry en gelyk in waardigheid en regte gebore. Hulle het verstand en gewete en behoort teenoor mekaar in 'n gees van broederskap op te tree.",
      ),
    ).toBe("und");
  });
  it("accepts new language filters and rejects unsupported codes", () => {
    expect(apiQuerySchema.parse({ language: "kk" }).language).toBe("kk");
    expect(apiQuerySchema.safeParse({ language: "made-up" }).success).toBe(
      false,
    );
  });
});
describe("taxonomy matching", () => {
  it("matches known aliases without conflating unrelated unknown industries", () => {
    expect(industryMatches("Инструменты разработчика", "Developer tools")).toBe(
      true,
    );
    expect(industryMatches("Healthcare", "медицина")).toBe(true);
    expect(industryMatches("Some unknown", "Other unknown")).toBe(false);
    expect(canonicalIndustry("Unclassified fixture")).toBe("Other / unclear");
    expect(canonicalIndustry("Tools")).toBe("Other / unclear");
    expect(canonicalIndustry("Инструменты")).toBe("Other / unclear");
  });
});
