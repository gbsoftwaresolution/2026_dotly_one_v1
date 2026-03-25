import baseConfig from '../../packages/config/eslint.config.js';

const adjusted = baseConfig.map((config) => {
	// Narrow overrides to the TS block from the shared config.
	if (Array.isArray(config.files) && config.files.includes('**/*.{ts,tsx}')) {
		return {
			...config,
			languageOptions: {
				...config.languageOptions,
				parserOptions: {
					...config.languageOptions?.parserOptions,
					// Include spec/test files for typed linting.
					project: './tsconfig.eslint.json',
				},
			},
			rules: {
				...config.rules,
				// These are JS rules that don't work well with TS in this repo.
				'no-undef': 'off',
				'no-redeclare': 'off',
			},
		};
	}
	return config;
});

adjusted.push({
	files: ['**/*.spec.ts', '**/*.test.ts'],
	rules: {
		'@typescript-eslint/no-unused-vars': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
	},
});

export default adjusted;
