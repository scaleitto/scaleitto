import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanTemplate, defaultTemplates, fillTemplate, resolveMessages, smsLink, suggestedKind, whatsappLink } from "../../src/features/messages/templates";

test("customer messages: defaults per language, saved texts, placeholders", () => {
  const empty = resolveMessages(null);
  assert.equal(empty.language, "dz");
  assert.equal(empty.texts.confirm, defaultTemplates.dz.confirm);
  const saved = resolveMessages({ language: "fr", templates: { noAnswer: "Salut {name} {hack} !", bad: "x" } });
  assert.equal(saved.texts.noAnswer, "Salut {name}  !");
  assert.equal(saved.texts.confirm, defaultTemplates.fr.confirm);
  assert.equal(cleanTemplate("a {order} {evil}"), "a {order}");
  assert.equal(fillTemplate("Bonjour {name}, commande {order}{missing}", { name: "Lina", order: "1001" }), "Bonjour Lina, commande 1001");
  assert.deepEqual(["call_back", "in_transit", "confirmed", "pending"].map(suggestedKind), ["noAnswer", "shipped", "delivery", "confirm"]);
  assert.equal(whatsappLink("0555 12 34 56", "Salut à toi"), "https://wa.me/213555123456?text=Salut%20%C3%A0%20toi");
  assert.equal(smsLink("+213555123456", "ok"), "sms:0555123456?body=ok");
});
