const fs = require('fs');

const bgRegex = /<div className="fixed inset-0 z-\[-1\] pointer-events-none flex items-center justify-center overflow-hidden">[\s\S]*?<\/div>/;
const newBg = `<div className="fixed inset-0 z-[-1] pointer-events-none bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-3xl" />`;

const glowRegex = /const BackgroundGlow = \(\) => \([\s\S]*?\);/;
const newGlow = `const BackgroundGlow = () => (\n    <div className="fixed inset-0 z-[-1] pointer-events-none bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-3xl" />\n  );`;

['login/page.tsx', 'signup/page.tsx', 'forgot-password/page.tsx', 'reset-password/page.tsx'].forEach(file => {
  const path = `frontend/src/app/(public)/${file}`;
  let content = fs.readFileSync(path, 'utf8');
  if (file === 'reset-password/page.tsx') {
    content = content.replace(glowRegex, newGlow);
  } else {
    content = content.replace(bgRegex, newBg);
  }
  fs.writeFileSync(path, content);
});
