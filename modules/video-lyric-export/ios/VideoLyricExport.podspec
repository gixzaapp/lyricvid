require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'VideoLyricExport'
  s.version        = package['version']
  s.summary        = 'Burn lyrics into a finished MP4'
  s.description    = 'Exports a lyric video with burned-in text'
  s.license        = 'UNLICENSED'
  s.author         = 'LyricVid'
  s.homepage       = 'https://github.com/'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'CoreMedia', 'UIKit'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
  s.source_files = '*.{h,m,swift}'
end
