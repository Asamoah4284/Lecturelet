/**
 * Copies backend/src into functions/backend-src so Cloud Functions can require it.
 * Run before: firebase deploy --only functions
 */
const fs = require('fs');
const path = require('path');

const backendSrc = path.join(__dirname, '..', 'backend', 'src');
const target = path.join(__dirname, '..', 'functions', 'backend-src');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.error('Backend src not found:', src);
    process.exit(1);
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (fs.existsSync(target)) {
  fs.rmSync(target, { recursive: true });
}
copyRecursive(backendSrc, target);
console.log('Copied backend/src to functions/backend-src');
