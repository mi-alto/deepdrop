import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLocale, translate } from "../lib/i18n";

test("explicit language wins; browser preferences respect quality and regional tags", () => {
  assert.equal(detectLocale("it", "en-US,en;q=0.9"), "it");
  assert.equal(detectLocale("en", "it-IT"), "en");
  assert.equal(detectLocale(null, "it-CH,it;q=0.8,en;q=0.5"), "it");
  assert.equal(detectLocale(null, "en;q=0.4,it;q=0.9"), "it");
  assert.equal(detectLocale(null, "it;q=0,en;q=1"), "en");
  assert.equal(detectLocale("invalid", "fr-FR,it;q=0.7"), "it");
  assert.equal(detectLocale(null, "fr-FR,de;q=0.5"), "en");
  assert.equal(detectLocale(null, "it;q=invalid,en"), "en");
  assert.equal(detectLocale(null, null), "en");
});
test("server errors and visible notices translate without changing arbitrary content", () => {
  assert.equal(
    translate("en", "Password non corretta."),
    "Incorrect password.",
  );
  assert.equal(
    translate("it", "Password non corretta."),
    "Password non corretta.",
  );
  assert.equal(
    translate("it", "PRIVATE FILE DELIVERY"),
    "CONDIVISIONE RISERVATA",
  );
  assert.equal(
    translate("en", "Client_report_2026.zip"),
    "Client_report_2026.zip",
  );
});
