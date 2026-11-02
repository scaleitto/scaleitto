import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidTag, normalizeTag } from "../../src/features/pixels/ids";
import { parseAccounts } from "../../src/features/pixels/validators";

test("tag IDs are checked per platform (they end up in inline scripts)", () => {
  assert.ok(isValidTag("meta", "123456789012345"));
  assert.ok(!isValidTag("meta", "12345abc"));
  assert.ok(isValidTag("tiktok", normalizeTag("tiktok", " c4abcdefghij123 ")));
  assert.ok(isValidTag("ga4", normalizeTag("ga4", "g-abc1234")));
  assert.ok(!isValidTag("ga4", "G-abc');alert(1)//"));
  assert.ok(isValidTag("gtm", "GTM-ABC1234"));
  assert.ok(!isValidTag("gtm", "G-ABC1234"));
  assert.ok(isValidTag("snapchat", "a1b2c3d4-0000-4000-8000-abcdef123456"));
  assert.ok(!isValidTag("snapchat", "a1b2c3d4');alert(1)//"));
});

test("app page accounts: ids normalized, errors per card, duplicates, Google's single ID", () => {
  const acc = (over: Record<string, unknown>) => ({ id: null, name: "", tagId: "", secret: "", clearSecret: false, testCode: "", purchaseOn: "placed", productIds: null, active: true, ...over });
  const ok = parseAccounts("ga4", JSON.stringify([acc({ tagId: "g-test1234" })]));
  assert.ok(ok.ok && ok.accounts[0].tagId === "G-TEST1234" && ok.accounts[0].name === "G-TEST1234");
  // an empty Google ID = nothing kept (the saved one is removed)
  const empty = parseAccounts("gtm", JSON.stringify([acc({ tagId: " " })]));
  assert.ok(empty.ok && empty.accounts.length === 0);
  assert.ok(!parseAccounts("gtm", JSON.stringify([acc({ tagId: "GTM-AAAA1" }), acc({ tagId: "GTM-BBBB2" })])).ok, "one ID only");
  const errors = parseAccounts("meta", JSON.stringify([acc({ tagId: "1234567" }), acc({ tagId: "abc" }), acc({ tagId: "1234567", productIds: [] })]));
  assert.ok(!errors.ok && errors.fieldErrors["tagId.1"] === "tagId" && errors.fieldErrors["tagId.2"] === "pixelDuplicate" && errors.fieldErrors["productIds.2"] === "pixelProducts" && !errors.fieldErrors["tagId.0"]);
  const snap = parseAccounts("snapchat", JSON.stringify([acc({ tagId: " A1B2C3D4-0000-4000-8000-ABCDEF123456 " })]));
  assert.ok(snap.ok && snap.accounts[0].tagId === "a1b2c3d4-0000-4000-8000-abcdef123456");
  assert.ok(!parseAccounts("meta", "not json").ok);
});
