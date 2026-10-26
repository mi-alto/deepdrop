import { cookies, headers } from "next/headers";
import { detectLocale, LANGUAGE_COOKIE, translate } from "./i18n";
export async function requestLocale() {
  return detectLocale(
    (await cookies()).get(LANGUAGE_COOKIE)?.value,
    (await headers()).get("accept-language"),
  );
}
export async function serverTranslation() {
  const locale = await requestLocale();
  return { locale, t: (message: string) => translate(locale, message) };
}
