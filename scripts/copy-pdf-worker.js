// Copies the pdfjs-dist worker into /public so it's served as a same-origin
// static asset (avoids webpack/Terser bundling the pre-minified worker, and
// keeps it in sync with the installed pdfjs-dist version on every build).
const fs = require("fs");
const path = require("path");

const src = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const destDir = path.join(__dirname, "..", "public");
const dest = path.join(destDir, "pdf.worker.min.mjs");

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`[copy-pdf-worker] ${src} -> ${dest}`);
