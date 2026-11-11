import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';

/**
 * Client side Meta App Events. Import through `measurement.ts` only, which loads this
 * file after the member has agreed to advertising measurement.
 *
 * Install and app open are logged by the SDK itself. Money events (Subscribe, Purchase,
 * StartTrial) are sent by the backend through the Conversions API after the payment is
 * confirmed, so ads report only real revenue. The app never logs them.
 */
export function initMetaSdk() {
  Settings.initializeSDK();
}

export function pauseMetaSdk() {
  Settings.setAutoLogAppEventsEnabled(false);
  Settings.setAdvertiserIDCollectionEnabled(false);
}

export function anonymousId() {
  return AppEventsLogger.getAnonymousID();
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
