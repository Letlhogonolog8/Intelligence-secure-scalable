const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// This Expo app lives inside the web monorepo, whose node_modules contains a
// different React. Force Metro to resolve packages ONLY from this app's
// node_modules so the web app's deps can never leak into the native bundle
// (which previously caused a React/React Native version mismatch crash).
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
config.resolver.disableHierarchicalLookup = true;

// On Windows there's no Watchman, so Metro's fallback watcher crawls into the
// native Gradle output (android/build, android/.cxx, and the per-library
// android/build dirs under node_modules). Gradle constantly creates/deletes
// those intermediates mid-build, which makes the watcher crash with
// "ENOENT: watch ...". Block all native build artifacts from the file map so
// Metro never watches them. These hold no JS the bundler needs.
config.resolver.blockList = [
  /.*[\\/]android[\\/]build[\\/].*/,
  /.*[\\/]android[\\/]app[\\/]build[\\/].*/,
  /.*[\\/]android[\\/]\.cxx[\\/].*/,
  /.*[\\/]android[\\/]\.gradle[\\/].*/,
  /.*[\\/]ios[\\/]build[\\/].*/,
];

module.exports = config;
