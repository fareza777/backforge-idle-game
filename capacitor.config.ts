import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.f7developer.backpackforge',
  appName: 'Backpack Forge',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#07060C',
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
      keystorePassword: undefined,
    },
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#F4E8CF',
    },
  },
};

export default config;
