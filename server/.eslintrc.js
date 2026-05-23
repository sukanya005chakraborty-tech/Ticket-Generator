module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "commonjs",
  },
  rules: {
    // Warn on console usage — prefer Winston logger in production code
    "no-console": ["warn", { allow: ["warn", "error"] }],

    // Catch unused variables at warn level (not error) to avoid CI blocking
    "no-unused-vars": [
      "warn",
      {
        vars: "all",
        args: "after-used",
        ignoreRestSiblings: true,
        argsIgnorePattern: "^(next|req|res|_)",
      },
    ],

    // Enforce const where possible
    "prefer-const": ["error", { destructuring: "any", ignoreReadBeforeAssign: false }],

    // Disallow var in favour of let/const
    "no-var": "error",

    // Require === instead of ==
    eqeqeq: ["error", "always", { null: "ignore" }],

    // Prevent accidentally returning values from async functions that aren't awaited
    "no-return-await": "warn",

    // Catch common async/await mistakes
    "require-await": "warn",

    // Disallow duplicate imports
    "no-duplicate-imports": "error",

    // Enforce consistent arrow function body style
    "arrow-body-style": ["warn", "as-needed"],

    // Disallow unnecessary semicolons
    "no-extra-semi": "error",

    // Warn on overly complex functions (cyclomatic complexity > 15)
    complexity: ["warn", { max: 15 }],
  },
  ignorePatterns: [
    "node_modules/",
    "coverage/",
    "dist/",
    "*.min.js",
  ],
};
