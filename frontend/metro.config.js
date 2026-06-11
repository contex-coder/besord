// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];

// Exclude nested project copy that was accidentally created inside frontend/
const nestedProject = path.join(__dirname, 'besord');
config.resolver.blockList = [
  new RegExp(`^${nestedProject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`),
];

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

module.exports = config;
