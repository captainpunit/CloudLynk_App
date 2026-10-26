import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';

/**
 * Client side Meta App Events.
 *
 * Install and app open are logged by the SDK itself. Money events
 * (Subscribe, StartTrial, renewals) are sent by the backend through the
 * Conversions API after Google Play verifies the purchase, so ads report
 * only real revenue. When the app also logs one of those events, it must
 * pass the same event_id the server uses so Meta can deduplicate.
 */
export function initMetaSdk() {
  Settings.initializeSDK();
}

export function setMetaUser(userId: string) {
  AppEventsLogger.setUserID(userId);
}

export function logViewPlans() {
  AppEventsLogger.logEvent('ViewContent', { content_type: 'subscription_plans' });
}

export function logCheckoutStarted(productId: string) {
  AppEventsLogger.logEvent(AppEventsLogger.AppEvents.InitiatedCheckout, {
    [AppEventsLogger.AppEventParams.ContentID]: productId,
  });
}
