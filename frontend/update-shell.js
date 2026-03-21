const fs = require('fs');
const path = 'frontend/src/components/layout/public-shell.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /const isCanonicalPublicProfileRoute =[\s\S]*?topLevelPath\[0\] !== "signup";/,
  `const isCanonicalPublicProfileRoute =
    topLevelPath.length === 1 &&
    topLevelPath[0] !== "login" &&
    topLevelPath[0] !== "signup" &&
    topLevelPath[0] !== "terms" &&
    topLevelPath[0] !== "privacy" &&
    topLevelPath[0] !== "verify-email";`
);

fs.writeFileSync(path, content);
