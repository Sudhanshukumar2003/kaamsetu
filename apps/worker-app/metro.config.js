const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const exclusionList = require("metro-config/src/defaults/exclusionList");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [
	path.join(projectRoot, "node_modules"),
	path.join(workspaceRoot, "node_modules"),
];
config.resolver.extraNodeModules = {
	react: path.join(projectRoot, "node_modules", "react"),
	"react-native": path.join(projectRoot, "node_modules", "react-native"),
};
const blockedExpoRnPath = path
	.join(workspaceRoot, "node_modules", "expo", "node_modules", "react-native")
	.replace(/\\/g, "/");
config.resolver.blockList = exclusionList([
	`${blockedExpoRnPath}.*`,
]);
config.transformer = {
	...config.transformer,
	babelTransformerPath: require.resolve("@expo/metro-config/babel-transformer"),
};

module.exports = config;
