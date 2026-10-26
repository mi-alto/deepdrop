import english from "./messages.en.json";
export type Locale = "en" | "it";
export const LANGUAGE_COOKIE = "dd_language";
const italian: Record<string, string> = {
  "PRIVATE FILE DELIVERY": "CONDIVISIONE RISERVATA",
  "PRIVATE BY DESIGN. DIRECT BY NATURE.":
    "RISERVATO PER SCELTA. DIRETTO PER NATURA.",
  WORKSPACE: "SPAZIO DI LAVORO",
  OVERVIEW: "PANORAMICA",
  "ADMIN CONSOLE": "CONSOLE AMMINISTRATORE",
  "NEW TRANSFER": "NUOVO INVIO",
  "DEEPDROP / FILE DELIVERY": "DEEPDROP / CONSEGNA FILE",
  "SOURCE / FILE": "ORIGINE / FILE",
  "TARGET / LINK": "DESTINAZIONE / LINK",
  "01 / TRANSFER LAYER": "01 / TRASFERIMENTO",
  "DEEPDROP / 404 — ROUTE NOT FOUND": "DEEPDROP / 404 — PERCORSO NON TROVATO",
  "DEEPDROP / TRANSFER CLOSED": "DEEPDROP / CONDIVISIONE CHIUSA",
};
export function translate(locale: Locale, message: string): string {
  const messages: Record<string, string> = locale === "en" ? english : italian;
  return Object.hasOwn(messages, message) ? messages[message] : message;
}
export function localeTag(locale: Locale) {
  return locale === "it" ? "it-IT" : "en-GB";
}
export function detectLocale(
  preference?: string | null,
  acceptLanguage?: string | null,
): Locale {
  if (preference === "it" || preference === "en") return preference;
  const languages = (acceptLanguage || "")
    .slice(0, 4096)
    .split(",")
    .map((entry, index) => {
      const [tag, ...parameters] = entry.trim().toLowerCase().split(";");
      const quality = parameters.find((p) => p.trim().startsWith("q="));
      const q = quality ? Number(quality.trim().slice(2)) : 1;
      return { tag: tag.split("-")[0], q, index };
    })
    .filter(({ q }) => Number.isFinite(q) && q > 0 && q <= 1)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { tag } of languages) if (tag === "en" || tag === "it") return tag;
  return "en";
}
