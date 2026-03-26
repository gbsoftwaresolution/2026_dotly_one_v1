const fs = require('fs');
let content = fs.readFileSync('src/components/personas/persona-sharing-settings-form.test.tsx', 'utf8');

// revert the mock payloads
content = content.replace(/primaryAction: "Connect",/g, 'primaryAction: "instant_connect",');
content = content.replace(/primaryAction: "Contact",/g, 'primaryAction: "contact_me",');

fs.writeFileSync('src/components/personas/persona-sharing-settings-form.test.tsx', content);
