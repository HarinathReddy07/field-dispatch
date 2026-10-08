// Writes css/tokens.css from the compiled tokens so Tailwind (admin) imports the same values the mobile app reads.
const fs = require('node:fs');
const path = require('node:path');
const { generateCssVariables, tailwindThemeCss } = require('../dist/index.js');

const out = path.join(__dirname, '..', 'css', 'tokens.css');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${generateCssVariables()}\n${tailwindThemeCss()}`);
