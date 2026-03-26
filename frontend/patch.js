const fs = require('fs');
let content = fs.readFileSync('src/components/personas/persona-sharing-settings-form.test.tsx', 'utf8');

content = content.replace(/await user\.selectOptions\(\s*screen\.getByRole\("button", \{ name: \/primary action\/i \}\),\s*"([^"]+)",\s*\);/g, (match, option) => {
  return `await user.click(screen.getByRole("button", { name: /primary action/i }));\n    await user.click(screen.getByRole("button", { name: "${option}" }));`;
});

fs.writeFileSync('src/components/personas/persona-sharing-settings-form.test.tsx', content);
