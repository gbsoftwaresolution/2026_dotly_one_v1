import baseConfig from "@booster-vault/config/eslint.config.js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Web app ESLint config.
 * Reuses the shared workspace config package so `pnpm -r lint` works.
 */
export default [
	...baseConfig,
	{
		files: ["src/**/*.{ts,tsx}", "src/**/*.test.ts", "src/**/*.spec.ts"],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.es2021,
			},
			parserOptions: {
				project: "./tsconfig.eslint.json",
			},
		},
		plugins: {
			"react-hooks": reactHooks,
		},
		rules: {
			// Base config is JS-first; in TS/browser code this is noisy + incorrect.
			"no-undef": "off",

			// Prefer TS-aware redeclare checks.
			"no-redeclare": "off",
			"@typescript-eslint/no-redeclare": "warn",

			// Avoid failing lint on stylistic import() type patterns for now.
			"@typescript-eslint/consistent-type-imports": "warn",

			// Allow deliberate empty catch blocks (we use them for best-effort cleanup).
			"no-empty": ["warn", { "allowEmptyCatch": true }],

			// Ensure hooks rules are actually available.
			...reactHooks.configs.recommended.rules,
		},
	},
];
