const { withAppBuildGradle, withEntitlementsPlist } = require('@expo/config-plugins');

const AAR_LINE =
  "implementation files('../../modules/video-lyric-export/android/libs/shazamkit-android-release.aar')";
const EXTRA_DEPS = [
  AAR_LINE,
  "implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1'",
  "implementation 'com.squareup.okhttp3:okhttp:4.12.0'",
  "implementation 'com.squareup.retrofit2:retrofit:2.11.0'",
  "implementation 'com.squareup.retrofit2:converter-gson:2.11.0'",
];

function withShazamAndroid(config) {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;
    for (const line of EXTRA_DEPS) {
      if (!contents.includes(line)) {
        contents = contents.replace(/dependencies\s*\{/, `dependencies {\n    ${line}`);
      }
    }
    mod.modResults.contents = contents;
    return mod;
  });
}

function withShazamIos(config) {
  return withEntitlementsPlist(config, (mod) => {
    mod.modResults['com.apple.developer.shazamkit'] = true;
    return mod;
  });
}

module.exports = function withShazamKit(config) {
  return withShazamAndroid(withShazamIos(config));
};
