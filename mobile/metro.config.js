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

// ../shared holds plain, dependency-free .ts type definitions shared with
// the web app (see mobile/src/shared/types.ts). It's outside this app's
// projectRoot, so Metro won't see it — or resolve mobile/src/shared/types.ts's
// relative import of it — unless it's an explicit watch folder. This does
// NOT affect node_modules resolution above: ../shared has no package.json
// and no dependencies of its own, so it can't reintroduce the React
// duplication bug that nodeModulesPaths/disableHierarchicalLookup guard
// against.
config.watchFolders = [path.resolve(projectRoot, "..", "shared")];

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
