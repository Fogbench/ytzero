Pod::Spec.new do |s|
  s.name = 'YtZeroSystemProfiles'
  s.version = '1.0.0'
  s.summary = 'Apple TV user preferences for YT Zero'
  s.license = { :type => 'AGPL-3.0-only' }
  s.author = 'YT Zero'
  s.homepage = 'https://github.com/pelski/ytzero'
  s.platforms = { :ios => '16.4', :tvos => '16.4' }
  s.source = { :git => 'https://github.com/pelski/ytzero.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.resource_bundles = { 'YtZeroSystemProfiles_privacy' => ['PrivacyInfo.xcprivacy'] }
end
