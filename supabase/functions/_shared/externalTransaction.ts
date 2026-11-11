/** A row of play_external_reports: one confirmed UPI payment to report to Google Play. */
export type ExternalReport = {
  id: string;
  lease_id: string;
  external_transaction_id: string;
  external_transaction_token: string;
  pre_tax_paise: number;
  tax_paise: number;
  tax_state: string;
  transaction_time: string;
  kind: "create" | "refund";
};

// Google prices are micro-units of the currency: 1 paisa = 10,000 micros.
const price = (paise: number) => ({
  priceMicros: String(paise * 10_000),
  currency: "INR",
});

/**
 * Request body for externaltransactions.createexternaltransaction. Each plan period is
 * paid for once and does not renew, so it is a one-time transaction. India taxes by
 * state, so Google requires the member's state.
 */
export function externalTransactionBody(report: ExternalReport) {
  return {
    originalPreTaxAmount: price(report.pre_tax_paise),
    originalTaxAmount: price(report.tax_paise),
    transactionTime: new Date(report.transaction_time).toISOString(),
    oneTimeTransaction: {
      externalTransactionToken: report.external_transaction_token,
    },
    userTaxAddress: {
      regionCode: "IN",
      administrativeArea: report.tax_state,
    },
  };
}

/** Request body for externaltransactions.refundexternaltransaction: always the full amount. */
export function externalRefundBody(report: ExternalReport) {
  return {
    refundTime: new Date(report.transaction_time).toISOString(),
    fullRefund: {},
  };
}
