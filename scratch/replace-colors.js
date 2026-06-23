const fs = require('fs');
const path = require('path');

const TARGET_DIR = path.join(__dirname, '..', 'src');

const REPLACEMENTS = [
  // Primary brand color
  { regex: /#009AD0/gi, replacement: '#17457C' },
  
  // Secondary / Gradient / Border variations
  { regex: /#0081AF/gi, replacement: '#0d2e5c' },
  { regex: /#007EA8/gi, replacement: '#0f3460' },
  { regex: /#007baa/gi, replacement: '#0f3460' },
  { regex: /#007da8/gi, replacement: '#0f3460' },
  { regex: /#0088b9/gi, replacement: '#123c6e' },
  
  // Specific styling in product-card-modern.tsx to align tailwind blue buttons with the brand color
  { regex: /bg-blue-600/g, replacement: 'bg-[#17457C]' },
  { regex: /hover:bg-blue-700/g, replacement: 'hover:bg-[#0f3460]' },
  { regex: /text-blue-600/g, replacement: 'text-[#17457C]' },
  { regex: /hover:text-blue-600/g, replacement: 'hover:text-[#17457C]' },
  { regex: /shadow-blue-600/g, replacement: 'shadow-[#17457C]' },
  { regex: /dark:text-blue-400/g, replacement: 'dark:text-[#17457C]' },
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  for (const rep of REPLACEMENTS) {
    content = content.replace(rep.regex, rep.replacement);
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${path.relative(TARGET_DIR, filePath)}`);
  }
}

function traverseDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      traverseDirectory(filePath);
    } else if (stat.isFile()) {
      const ext = path.extname(file);
      if (['.ts', '.tsx', '.js', '.jsx', '.css'].includes(ext)) {
        processFile(filePath);
      }
    }
  }
}

console.log("Starting brand color replacements...");
traverseDirectory(TARGET_DIR);
console.log("Brand color replacement completed!");
