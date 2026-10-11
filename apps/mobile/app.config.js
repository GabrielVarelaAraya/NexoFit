/* eslint-disable @typescript-eslint/no-require-imports */
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { config } = require('dotenv');
config({ path: resolve(__dirname, '../../.env') });

// Los iconos son opcionales mientras no se agreguen los archivos de marca.
const optionalAsset = (filename) =>
  existsSync(resolve(__dirname, 'assets', filename)) ? './assets/' + filename : undefined;

module.exports = {
  expo: {
    name: 'NexoFit',
    slug: 'nexofit',
    version: '0.1.0',
    orientation: 'portrait',
    icon: optionalAsset('icon.png'),
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
        foregroundImage: optionalAsset('android-icon-foreground.png'),
        backgroundImage: optionalAsset('android-icon-background.png'),
        monochromeImage: optionalAsset('android-icon-monochrome.png'),
      },
    },
    web: {
      favicon: optionalAsset('favicon.png'),
      backgroundColor: '#F8F6EF',
    },
    scheme: 'nexofit',
    extra: {
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
};
