/**
 * compile.js — Pre-compiles JSX in house-ledger.jsx.html → house-ledger.html
 * 
 * Removes Babel standalone (~800KB) by converting JSX to React.createElement
 * at build time. Output is ~70KB and loads instantly on mobile Safari.
 *
 * Usage:  npm install && node compile.js
 * Output: dist/house-ledger.html
 */

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const SRC = path.join(__dirname, 'src', 'house-ledger.jsx.html');
const OUT = path.join(__dirname, 'dist', 'house-ledger.html');

// Read source
const html = fs.readFileSync(SRC, 'utf8');

// Extract JSX script block
const match = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
if (!match) {
  console.error('ERROR: No <script type="text/babel"> block found in source.');
  process.exit(1);
}

const jsx = match[1];

// Compile JSX → React.createElement
const result = babel.transformSync(jsx, {
  presets: [[require.resolve('@babel/preset-react'), { runtime: 'classic' }]],
  filename: 'house-ledger.jsx'
});

if (!result || !result.code) {
  console.error('ERROR: Babel compilation failed.');
  process.exit(1);
}

// Assemble output: remove Babel CDN script, replace babel script with compiled
let output = html;

// Remove the section index comment block (between {/* and */})
output = output.replace(/\n\{\/\* ═+[\s\S]*?═+ \*\/\}\n/, '\n');

// Remove Babel standalone <script> tag
output = output.replace(
  /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/babel-standalone\/[^"]*"><\/script>\n?/,
  ''
);

// Replace <script type="text/babel">...</script> with compiled <script>...</script>
output = output.replace(
  /<script type="text\/babel">[\s\S]*?<\/script>/,
  '<script>' + result.code + '</script>'
);

// Ensure dist directory exists
const distDir = path.dirname(OUT);
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

fs.writeFileSync(OUT, output, 'utf8');

const sizeKB = (Buffer.byteLength(output, 'utf8') / 1024).toFixed(1);
const elemCount = (result.code.match(/React\.createElement/g) || []).length;
const babelRefs = (output.match(/babel/gi) || []).length;

console.log(`✅ Compiled successfully`);
console.log(`   Source:  ${SRC}`);
console.log(`   Output:  ${OUT}`);
console.log(`   Size:    ${sizeKB} KB`);
console.log(`   React.createElement calls: ${elemCount}`);
console.log(`   Babel references: ${babelRefs} (should be 0)`);
