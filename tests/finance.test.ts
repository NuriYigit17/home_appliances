import test from "node:test";
import assert from "node:assert/strict";
import {
  addMonthsClamped,
  buildPlan,
  installmentStatus,
  parseMoney,
} from "../src/lib/finance";

test("Türk lirası girişleri kuruşa doğru çevrilir", () => {
  assert.equal(parseMoney("1.000,50"), 100050);
  assert.equal(parseMoney("1000,50"), 100050);
  assert.equal(parseMoney("1.000"), 100000);
  assert.equal(parseMoney("0,05"), 5);
  assert.equal(parseMoney("12,345"), null);
});

test("31. gün seçilince kısa aylar ay sonuna düşer ve sonra 31'e döner", () => {
  assert.equal(addMonthsClamped("2027-01-31", 1), "2027-02-28");
  assert.equal(addMonthsClamped("2027-01-31", 2), "2027-03-31");
  assert.equal(addMonthsClamped("2028-01-31", 1), "2028-02-29");
});

test("peşinat sonrası kalan tutar taksitlere kuruş kaybetmeden bölünür", () => {
  const plan = buildPlan(100001, 3, "2026-11-30");
  assert.deepEqual(
    plan.map((part) => part.amountCents),
    [33333, 33333, 33335],
  );
  assert.equal(
    plan.reduce((sum, part) => sum + part.amountCents, 0),
    100001,
  );
});

test("kısmi ödeme taksiti kapatmaz", () => {
  assert.equal(
    installmentStatus(100000, 50000, "2026-11-01", "2026-10-26"),
    "partial",
  );
  assert.equal(
    installmentStatus(100000, 100000, "2026-11-01", "2026-10-26"),
    "paid",
  );
  assert.equal(
    installmentStatus(100000, 50000, "2026-10-25", "2026-10-26"),
    "overdue",
  );
});
