const workletsPluginOptions = {
  // Your custom options.
}
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { unstable_transformImportMeta: true, jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      ['react-native-worklets/plugin', workletsPluginOptions],
      'react-native-reanimated/plugin', // 必须在最后
    ],
  };
};