// Preview builds do not include advertising/attribution native modules.
// Enable only with a configured, consent-gated production integration.
const nativeIntegrations = process.env.EXPO_PUBLIC_NATIVE_INTEGRATIONS === 'true';
module.exports = {
  dependencies: nativeIntegrations
    ? {}
    : {
        'react-native-fbsdk-next': { platforms: { android: null, ios: null } },
        'react-native-play-install-referrer': { platforms: { android: null, ios: null } },
      },
};
