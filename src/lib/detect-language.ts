import { francAll } from "franc";
import { type languageCodes } from "./language-options";

const codes: Record<string, (typeof languageCodes)[number]> = {
  eng: "en",
  rus: "ru",
  kaz: "kk",
  ukr: "uk",
  spa: "es",
  por: "pt",
  fra: "fr",
  deu: "de",
  ita: "it",
  tur: "tr",
  arb: "ar",
  hin: "hi",
  cmn: "zh",
  jpn: "ja",
  kor: "ko",
};

export function detectLanguage(text: string): (typeof languageCodes)[number] {
  const sample = text
    .slice(0, 12000)
    .replace(/```[\s\S]*?```|`[^`]*`|https?:\/\/\S+/g, " ")
    .slice(0, 6000);
  const letters = sample.match(/\p{L}/gu) || [];
  if (letters.length < 40) return "und";
  // Mixed scripts are not collapsed into whichever alphabet appears first.
  const scripts = [
    /[\p{Script=Latin}]/gu,
    /[\p{Script=Cyrillic}]/gu,
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu,
    /[\p{Script=Arabic}]/gu,
    /[\p{Script=Devanagari}]/gu,
    /[\p{Script=Hangul}]/gu,
  ];
  if (
    Math.max(...scripts.map((s) => (sample.match(s) || []).length)) /
      letters.length <
    0.8
  )
    return "und";
  const ranked = francAll(sample, { minLength: 40 });
  const best = ranked[0];
  if (!best || !codes[best[0]] || (ranked[1] && best[1] - ranked[1][1] < 0.02))
    return "und";
  return codes[best[0]];
}
