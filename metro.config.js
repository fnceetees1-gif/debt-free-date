// metro.config.js
// Required from SDK 52 onward — earlier versions could infer a default config.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
