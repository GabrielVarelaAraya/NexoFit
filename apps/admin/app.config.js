/* eslint-disable @typescript-eslint/no-require-imports */
const { config } = require('dotenv');
config({ path: '../../.env' });

const base = require('./app.json').expo;

module.exports = {
  expo: {
    ...base,
    extra: {
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
};
