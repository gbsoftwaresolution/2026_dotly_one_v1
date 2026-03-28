const fs = require('fs');

const inputRegex = /className="min-h-\[56px\] w-full rounded-\[16px\].*?focus:bg-white\/\[0\.07\]"/g;
const newInput = `className="min-h-[56px] w-full rounded-2xl bg-white/50 dark:bg-zinc-800/50 backdrop-blur-md px-4 py-3 text-[16px] font-medium text-foreground outline-none transition-all duration-300 ring-1 ring-black/5 dark:ring-white/10 placeholder:text-muted/50 focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"`;

['forgot-password/page.tsx', 'reset-password/page.tsx'].forEach(file => {
  const path = `frontend/src/app/(public)/${file}`;
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(inputRegex, newInput);
  fs.writeFileSync(path, content);
});
