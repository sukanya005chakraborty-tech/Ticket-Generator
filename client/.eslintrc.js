module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  plugins: ["react", "react-hooks"],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      // Automatically detect the React version from package.json
      version: "detect",
    },
  },
  rules: {
    // React 17+ JSX transform — no need to import React in scope
    "react/react-in-jsx-scope": "off",

    // prop-types validation is handled by TypeScript / Zod schemas
    "react/prop-types": "off",

    // Enforce exhaustive deps in useEffect / useCallback / useMemo
    "react-hooks/exhaustive-deps": "warn",

    // Disallow rules-of-hooks violations
    "react-hooks/rules-of-hooks": "error",

    // Disallow unused variables
    "no-unused-vars": [
      "warn",
      {
        vars: "all",
        args: "after-used",
        ignoreRestSiblings: true,
        argsIgnorePattern: "^_",
      },
    ],

    // Prefer const
    "prefer-const": "error",

    // No var
    "no-var": "error",

    // Enforce === over ==
    eqeqeq: ["error", "always", { null: "ignore" }],

    // Self-closing tags for components without children
    "react/self-closing-comp": ["warn", { component: true, html: false }],

    // Warn on console.log in components (leave console.error/warn)
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
  ignorePatterns: [
    "node_modules/",
    "dist/",
    "coverage/",
    "*.min.js",
    "vite.config.js",
    "tailwind.config.js",
    "postcss.config.js",
  ],
};
