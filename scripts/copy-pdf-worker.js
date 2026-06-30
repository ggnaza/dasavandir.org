// Copies the pdfjs-dist worker into /public so it's served as a same-origin
// static asset (avoids webpack/Terser bundling the pre-minified worker, and
// keeps it in sync with the installed pdfjs-dist version on every build).
const fs = require("fs");
const path = require("path");

const src = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const destDir = path.join(__dirname, "..", "public");
const dest = path.join(destDir, "pdf.worker.min.mjs");

// pdfjs uses Promise.withResolvers inside the worker's own global scope, which
// the app-side polyfill can't reach. Prepend a polyfill so the worker runs on
// older browsers (Safari < 17.4 etc.) instead of throwing.
const polyfill =
  "if(typeof Promise.withResolvers!=='function'){Promise.withResolvers=function(){let a,b;const c=new Promise((d,e)=>{a=d;b=e;});return{promise:c,resolve:a,reject:b};};}\n";

fs.mkdirSync(destDir, { recursive: true });
fs.writeFileSync(dest, polyfill + fs.readFileSync(src, "utf8"));
console.log(`[copy-pdf-worker] ${src} -> ${dest} (+Promise.withResolvers polyfill)`);
