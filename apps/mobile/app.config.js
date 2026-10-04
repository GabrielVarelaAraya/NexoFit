/* eslint-disable @typescript-eslint/no-require-imports */
const { config } = require('dotenv');
config({ path: '../../.env' });

module.exports = {
  expo: {
    name: 'NexoFit',
    slug: 'nexofit',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    backgroundColor: '#F8F6EF',
    splash: {
      backgroundColor: '#F8F6EF',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.nexofit.app',
    },
    android: {
      package: 'com.nexofit.app',
      adaptiveIcon: {
        backgroundColor: '#06354E',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
    },
    web: {
      favicon: './assets/favicon.png',
      backgroundColor: '#F8F6EF',
    },
    scheme: 'nexofit',
    extra: {
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
};
