/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Vista previa web (`pnpm --filter @nexofit/mobile web`): react-native-screens
// publica componentes "gamma" generados por codegen que solo existen para
// iOS/Android, así que Metro no puede resolverlos en web. Se sustituyen por un
// View genérico SOLO cuando platform === 'web'; los builds nativos no cambian.
const previousResolveRequest = config.resolver.resolveRequest;
const generatedNativeComponent = path.resolve(__dirname, 'src/web/GeneratedNativeComponent.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isGeneratedNativeComponent =
    platform === 'web' && /NativeComponent(\.(js|tsx?))?$/.test(moduleName);

  if (isGeneratedNativeComponent) {
    return { type: 'sourceFile', filePath: generatedNativeComponent };
  }

  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
