module.exports = {
    globals: {
        'ts-jest': {
            tsConfig: 'tsconfig.srv.json'
        }
    },
    "roots": [
        "<rootDir>/src-srv"
    ],
    testMatch: [
        "**/__tests__/**/*.+(ts|tsx|js|mjs)",
        "**/?(*.)+(spec|test).+(ts|tsx|js|mjs)"
    ],
    "transform": {
        "^.+\\.(ts|tsx)$": "ts-jest"
    },
};
