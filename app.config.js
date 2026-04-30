/**
 * Dynamic Expo config - allows env vars for Google Maps API key.
 * Set GOOGLE_MAPS_API_KEY or EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env or EAS secrets.
 */
const expoConfig = {
  name: 'Ekatraa',
  slug: 'ekatraa',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/android/play_store_512.png',
  userInterfaceStyle: 'automatic',
  scheme: 'ekatraa',
  splash: {
    image: './assets/android/play_store_512.png',
    resizeMode: 'contain',
    backgroundColor: '#FF4117',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.ekatraa.userapp',
    infoPlist: {
      NSCameraUsageDescription:
        'Allow Ekatraa to access your camera for profile photos.',
      NSPhotoLibraryUsageDescription:
        'Allow Ekatraa to access your photos for profile pictures.',
      NSLocationWhenInUseUsageDescription:
        'Allow Ekatraa to access your location to show nearby venues and vendors.',
    },
  },
  android: {
    package: 'com.ekatraa.userapp',
    adaptiveIcon: {
      foregroundImage:
        './assets/android/res/mipmap-xxxhdpi/ic_launcher_foreground.png',
      backgroundImage:
        './assets/android/res/mipmap-xxxhdpi/ic_launcher_background.png',
      monochromeImage:
        './assets/android/res/mipmap-xxxhdpi/ic_launcher_monochrome.png',
    },
    edgeToEdgeEnabled: true,
    permissions: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.CAMERA',
      'android.permission.READ_EXTERNAL_STORAGE',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'ekatraa', host: 'auth-callback' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: { favicon: './assets/favicon.png' },
  extra: {
    eas: { projectId: '94c34160-9afb-4576-93fc-e7f5f5e9a843' },
  },
  plugins: [
    '@react-native-community/datetimepicker',
    'expo-location',
    'expo-notifications',
    'expo-web-browser',
  ],
  updates: {
    enabled: false,
    checkAutomatically: 'ON_ERROR_RECOVERY',
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: {
    policy: 'sdkVersion',
  },
};

const googleMapsApiKey =
  process.env.GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

module.exports = {
  expo: {
    ...expoConfig,
    android: {
      ...expoConfig.android,
      config: {
        ...(expoConfig.android?.config || {}),
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    ios: {
      ...expoConfig.ios,
      config: {
        ...(expoConfig.ios?.config || {}),
        googleMapsApiKey: googleMapsApiKey,
      },
    },
  },
};
