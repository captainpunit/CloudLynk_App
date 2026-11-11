import {
  externalRefundBody,
  externalTransactionBody,
} from "../../functions/_shared/externalTransaction.ts";
import { productPurchaseProblem } from "../../functions/_shared/playProduct.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

Deno.test("external transaction body matches Google's India format", () => {
  equal(
    externalTransactionBody({
      id: "1",
      lease_id: "2",
      external_transaction_id: "upi-abc",
      external_transaction_token: "token",
      pre_tax_paise: 10000,
      tax_paise: 1800,
      tax_state: "GUJARAT",
      transaction_time: "2026-11-11T10:00:00+05:30",
      kind: "create",
    }),
    {
      originalPreTaxAmount: { priceMicros: "100000000", currency: "INR" },
      originalTaxAmount: { priceMicros: "18000000", currency: "INR" },
      transactionTime: "2026-11-11T04:30:00.000Z",
      oneTimeTransaction: { externalTransactionToken: "token" },
      userTaxAddress: { regionCode: "IN", administrativeArea: "GUJARAT" },
    },
  );
});

Deno.test("only a paid Play purchase owned by the account is granted", () => {
  const paid = { purchaseState: 0, obfuscatedExternalAccountId: "acct" };
  equal(productPurchaseProblem(paid, "acct"), null);
  equal(
    productPurchaseProblem({ ...paid, purchaseState: 2 }, "acct")?.code,
    "purchase_pending",
  );
  equal(
    productPurchaseProblem({ ...paid, purchaseState: 1 }, "acct")?.code,
    "invalid_purchase",
  );
  equal(productPurchaseProblem({}, "acct")?.code, "invalid_purchase");
  equal(
    productPurchaseProblem(paid, "other")?.code,
    "purchase_owner_mismatch",
  );
  equal(productPurchaseProblem(paid, null)?.code, "purchase_owner_mismatch");
  equal(
    productPurchaseProblem({ purchaseState: 0 }, "acct")?.code,
    "purchase_owner_mismatch",
  );
});

Deno.test("a refund report is a full refund at the refund time", () => {
  equal(
    externalRefundBody({
      id: "1",
      lease_id: "2",
      external_transaction_id: "upi-abc",
      external_transaction_token: "token",
      pre_tax_paise: 10000,
      tax_paise: 1800,
      tax_state: "GUJARAT",
      transaction_time: "2026-11-12T00:00:00Z",
      kind: "refund",
    }),
    { refundTime: "2026-11-12T00:00:00.000Z", fullRefund: {} },
  );
});
