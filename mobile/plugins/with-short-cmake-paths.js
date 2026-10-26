const { withAppBuildGradle } = require('expo/config-plugins');

/** Pin modern CMake/Ninja and hash long object paths for the Windows workspace. */
module.exports = function withShortCmakePaths(config) {
  return withAppBuildGradle(config, (result) => {
    if (!result.modResults.contents.includes('CMAKE_OBJECT_PATH_MAX')) {
      result.modResults.contents = result.modResults.contents.replace(
        'defaultConfig {',
        `defaultConfig {
        externalNativeBuild {
            cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=128" }
        }`,
      );
    }
    result.modResults.contents = result.modResults.contents.replace(
      /CMAKE_OBJECT_PATH_MAX=\d+/g,
      'CMAKE_OBJECT_PATH_MAX=128',
    );
    if (!result.modResults.contents.includes('version "3.31.6"')) {
      result.modResults.contents = result.modResults.contents.replace(
        'android {',
        `android {
    externalNativeBuild {
        cmake { version "3.31.6" }
    }`,
      );
    }
    return result;
  });
};
