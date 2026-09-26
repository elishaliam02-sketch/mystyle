// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The food classifier ships as a TensorFlow Lite model, loaded natively
// (react-native-fast-tflite) from the app bundle like any other asset.
config.resolver.assetExts.push("tflite");

module.exports = config;
