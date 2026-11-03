import { test } from "node:test";
import assert from "node:assert/strict";
import { inQuietHours, resolveApps } from "../../src/features/apps/settings";
import { laterStatus, readReply, replyPayload, templateName, templateParams, waPhone } from "../../src/features/whatsapp/messages";

test("whatsapp settings: defaults and cleaning", () => {
  const w = resolveApps({}).whatsapp;
  assert.equal(w.enabled, false);
  assert.equal(w.reminder, true);
  assert.equal(w.products, null);
  assert.deepEqual(Object.values(w.notify), [false, false, false, false, false, false]);
  const x = resolveApps({ whatsapp: { enabled: true, quietFrom: 30, quietTo: 7, language: "de", products: ["a", 3], notify: { shipped: true } } }).whatsapp;
  assert.equal(x.quietFrom, 22);
  assert.equal(x.quietTo, 7);
  assert.equal(x.language, "");
  assert.deepEqual(x.products, ["a"]);
  assert.equal(x.notify.shipped, true);
  assert.equal(x.notify.delivered, false);
});

test("quiet hours: across midnight, same day, none", () => {
  const night = { quietFrom: 22, quietTo: 8 };
  assert.ok(inQuietHours(night, 23));
  assert.ok(inQuietHours(night, 3));
  assert.ok(!inQuietHours(night, 8));
  assert.ok(!inQuietHours(night, 15));
  const noon = { quietFrom: 12, quietTo: 14 };
  assert.ok(inQuietHours(noon, 13));
  assert.ok(!inQuietHours(noon, 14));
  assert.ok(!inQuietHours({ quietFrom: 5, quietTo: 5 }, 5));
});

test("whatsapp numbers, templates and replies", () => {
  assert.equal(waPhone("0555 12 34 56"), "213555123456");
  assert.equal(waPhone("+213 661234567"), "213661234567");
  assert.equal(waPhone("00213771234567"), "213771234567");
  assert.equal(waPhone("021234567"), null);
  assert.equal(templateName("confirm"), "scaleitto_confirm");
  const base = { customerName: " Amine  B ", shopName: "Shop", number: 1001, products: "Montre × 1", total: "3 500 DA", tracking: null };
  assert.deepEqual(templateParams("confirm", base), ["Amine B", "Shop", "#1001", "Montre × 1", "3 500 DA"]);
  assert.deepEqual(templateParams("shipped", base), ["Amine B", "Shop", "#1001", "—"]);
  const p = replyPayload("cancel", "abc-1");
  assert.deepEqual(readReply(p), { answer: "cancelled", orderId: "abc-1" });
  assert.equal(readReply("hello"), null);
  assert.equal(laterStatus("sent", "read"), "read");
  assert.equal(laterStatus("read", "delivered"), null);
  assert.equal(laterStatus("queued", "sent"), "sent");
});
