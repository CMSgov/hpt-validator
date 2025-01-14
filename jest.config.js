const config = {
  moduleFileExtensions: ["js", "ts", "jsx", "tsx"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/test/tsconfig.json",
        useESM: true,
      },
    ],
  },
  // transform: {},
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testMatch: ["**/test/**/*.test.(ts|js)"],
  testEnvironment: "node",
  setupFilesAfterEnv: ["jest-extended/all"],
  preset: "ts-jest",
};

export default config;
