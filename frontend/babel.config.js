module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: '.env',
          blacklist: null,
          whitelist: null,
          safe: false,
          allowUndefined: true,
        },
      ],
      // Modern Babel transform plugins (not proposals)
      '@babel/plugin-transform-class-properties',
      '@babel/plugin-transform-numeric-separator',
      '@babel/plugin-transform-optional-chaining',
      '@babel/plugin-transform-object-rest-spread',
      '@babel/plugin-transform-optional-catch-binding',
      '@babel/plugin-transform-async-generator-functions',
      '@babel/plugin-transform-nullish-coalescing-operator',
      '@babel/plugin-transform-logical-assignment-operators',
    ],
  };
};
