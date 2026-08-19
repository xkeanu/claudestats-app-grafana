module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/?(*.)+(spec|test).+(ts|tsx|js)'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        sourceMaps: true,
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
            decorators: false,
            dynamicImport: true,
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    '\\.(css|scss|sass)$': 'identity-obj-proxy',
    '\\.(svg|png|jpg|jpeg|gif)$': '<rootDir>/src/__mocks__/fileMock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  // @grafana/data pulls in ESM-only transitive deps (marked, and its own
  // uuid/ol chain); they must be transformed rather than ignored.
  transformIgnorePatterns: ['node_modules/(?!(@grafana|marked|uuid|@braintree|d3|d3-.*|internmap|delaunator|robust-predicates|ol|rbush|quickselect|earcut|pbf|geotiff|color-.*|nanoid)/)'],
};
