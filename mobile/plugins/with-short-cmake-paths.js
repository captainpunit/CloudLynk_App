const { withAppBuildGradle, withProjectBuildGradle } = require('expo/config-plugins');

// CMake 3.31.6 ships Ninja 1.12, which handles Windows paths over 260 characters.
// The SDK default (3.22.1, Ninja 1.10) fails on deep paths in this workspace.
const CMAKE_VERSION = '3.31.6';
const LIBRARY_MARKER = '// CloudLynk: native library modules use CMake';

/** Pin modern CMake/Ninja and hash long object paths for the Windows workspace. */
module.exports = function withShortCmakePaths(config) {
  config = withAppBuildGradle(config, (result) => {
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
    if (!result.modResults.contents.includes(`version "${CMAKE_VERSION}"`)) {
      result.modResults.contents = result.modResults.contents.replace(
        'android {',
        `android {
    externalNativeBuild {
        cmake { version "${CMAKE_VERSION}" }
    }`,
      );
    }
    return result;
  });

  // Libraries such as react-native-worklets build their own C++ and would otherwise
  // fall back to the SDK default CMake. None of them pin a version themselves.
  return withProjectBuildGradle(config, (result) => {
    if (!result.modResults.contents.includes(LIBRARY_MARKER)) {
      result.modResults.contents =
        result.modResults.contents.trimEnd() +
        `

${LIBRARY_MARKER} ${CMAKE_VERSION} for long Windows paths.
subprojects {
    plugins.withId('com.android.library') {
        android.externalNativeBuild.cmake.version = '${CMAKE_VERSION}'
    }
}
`;
    }
    return result;
  });
};
