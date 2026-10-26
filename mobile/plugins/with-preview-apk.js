const { withAppBuildGradle } = require('expo/config-plugins');

/** Optional standalone preview: embed JS, retain debug signing, disable dev-server startup. */
module.exports = function withPreviewApk(config) {
  return withAppBuildGradle(config, (result) => {
    // Replace only our generated block so repeated prebuilds also apply config updates.
    result.modResults.contents = result.modResults.contents.replace(
      /\n\/\/ Local review APK only[^\n]*\nif \(System\.getenv\("CLOUDLYNK_EMBED_PREVIEW"\) == "true"\) \{[\s\S]*?\n\}\n?/,
      '',
    );
    result.modResults.contents =
      result.modResults.contents.trimEnd() +
      `
// Local review APK only. Production builds require owner-managed release signing.
if (System.getenv("CLOUDLYNK_EMBED_PREVIEW") == "true") {
    extensions.getByType(com.facebook.react.ReactExtension).debuggableVariants.set([])
    android.buildTypes.debug.debuggable = false
    android.buildTypes.debug.applicationIdSuffix = ".preview"
    android.buildTypes.debug.resValue("string", "app_name", "CloudLynk Preview")
}
`;
    return result;
  });
};
