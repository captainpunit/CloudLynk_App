/**
 * Google Play Developer API helpers (subscriptionsv2).
 * GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{pkg}/purchases/subscriptionsv2/tokens/{token}
 * Auth: OAuth token from GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (scope androidpublisher).
 */
export function getSubscriptionV2(_purchaseToken: string): Promise<unknown> {
  // TODO (subscription PR): service account JWT -> access token, call API, map state.
  throw new Error("getSubscriptionV2 not implemented yet");
}

export function acknowledgeSubscription(_productId: string, _purchaseToken: string): Promise<void> {
  // TODO: Play refunds unacknowledged purchases after 3 days, so acknowledge after granting access.
  throw new Error("acknowledgeSubscription not implemented yet");
}
