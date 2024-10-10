const config = {
  moduleFileExtensions: ['js', 'ts'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/test/tsconfig.json'
      }
    ]
  },
  testMatch: ['**/test/**/*.test.(ts|js)'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['jest-extended/all'],
  preset: 'ts-jest'
}

export default config