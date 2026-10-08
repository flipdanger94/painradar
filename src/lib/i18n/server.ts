import { cookies, headers } from "next/headers";
import { translate, validLocale } from "./messages";
export async function serverTranslation() {
  const jar = await cookies();
  const locale = validLocale(
    jar.get("painradar-locale")?.value ||
      (await headers()).get("accept-language")?.split(",")[0].split("-")[0],
  );
  return (text: string) => translate(locale, text);
}
