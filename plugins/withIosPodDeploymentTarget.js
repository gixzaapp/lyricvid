const { withPodfile } = require('@expo/config-plugins');

const MIN_IOS = '15.0';
const MARKER = `config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'`;

function withIosPodDeploymentTarget(config) {
  return withPodfile(config, (mod) => {
    let contents = mod.modResults.contents;
    if (contents.includes("POD_IPHONEOS_DEPLOYMENT_TARGET_BUMP")) {
      return mod;
    }

    if (contents.includes("config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'")) {
      contents = contents.replace(
        "config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'",
        "config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'\n          " + MARKER,
      );
    }

    contents = contents.replace(
      /post_install do \|installer\|/,
      `post_install do |installer|
    # POD_IPHONEOS_DEPLOYMENT_TARGET_BUMP
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |cfg|
        dt = cfg.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if dt.nil? || dt.to_f < ${MIN_IOS}.to_f
          cfg.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'
        end
      end
    end`,
    );

    mod.modResults.contents = contents;
    return mod;
  });
}

module.exports = withIosPodDeploymentTarget;
