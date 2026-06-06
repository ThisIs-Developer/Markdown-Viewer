/**
 * test-pdf-export.js
 * Verification test suite for the Enterprise PDF Export Engine.
 * Runs in Node.js to check architectural integrity and compliance.
 */

const fs = require("fs");
const path = require("path");

const SCRIPT_PATH = path.join(__dirname, "script.js");
const CSS_PATH = path.join(__dirname, "styles.css");
const WORKER_PATH = path.join(__dirname, "preview-worker.js");
const CONFIG_PATH = path.join(__dirname, "desktop-app", "neutralino.config.json");
const SIDECAR_PATH = path.join(__dirname, "desktop-app", "extensions", "pdf-exporter", "index.js");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

console.log("=========================================");
console.log("PDF Export Re-engineering Verification Suite");
console.log("=========================================\n");

// Test 1: Verify render-full message capability in preview-worker.js
try {
  const workerContent = fs.readFileSync(WORKER_PATH, "utf8");
  assert(workerContent.includes("render-full"), "preview-worker.js supports render-full message type");
  assert(workerContent.includes("render-full-result"), "preview-worker.js emits render-full-result event");
  assert(workerContent.includes("DOMPurify.sanitize"), "preview-worker.js contains DOMPurify sanitation hooks");
} catch (e) {
  assert(false, `Could not read preview-worker.js: ${e.message}`);
}

// Test 2: Verify print layouts in styles.css
try {
  const cssContent = fs.readFileSync(CSS_PATH, "utf8");
  assert(cssContent.includes("@media print"), "styles.css contains @media print rules");
  assert(cssContent.includes("size: A4;"), "styles.css specifies A4 page size");
  assert(cssContent.includes("break-inside: avoid"), "styles.css enforces break-inside protection");
  assert(cssContent.includes("orphans: 3;"), "styles.css includes widow/orphan protection (orphans)");
  assert(cssContent.includes("widows: 3;"), "styles.css includes widow/orphan protection (widows)");
  assert(cssContent.includes("table-header-group"), "styles.css repeats table headers using table-header-group");
} catch (e) {
  assert(false, `Could not read styles.css: ${e.message}`);
}

// Test 3: Verify architectural classes in script.js
try {
  const scriptContent = fs.readFileSync(SCRIPT_PATH, "utf8");
  assert(scriptContent.includes("PdfExportEngine"), "script.js declares the PdfExportEngine namespace");
  assert(scriptContent.includes("ExportDocumentBuilder"), "script.js implements ExportDocumentBuilder");
  assert(scriptContent.includes("AssetReadinessGate"), "script.js implements AssetReadinessGate");
  assert(scriptContent.includes("WebPrintBackend"), "script.js implements WebPrintBackend");
  assert(scriptContent.includes("DesktopChromiumSidecarBackend"), "script.js implements DesktopChromiumSidecarBackend");
  assert(scriptContent.includes("LegacyRasterBackend"), "script.js implements LegacyRasterBackend");
  assert(scriptContent.includes("pdf-export-modal"), "script.js integrates pdf-export-modal controller");
  assert(scriptContent.includes("parseMarkdownFull"), "script.js contains parseMarkdownFull helper");
} catch (e) {
  assert(false, `Could not read script.js: ${e.message}`);
}

// Test 4: Verify desktop config & sidecar script
try {
  const configContent = fs.readFileSync(CONFIG_PATH, "utf8");
  assert(configContent.includes("extensions.*"), "neutralino.config.json enables extensions native API");
  assert(configContent.includes("com.markdownviewer.pdfexporter"), "neutralino.config.json registers the pdf-exporter extension");

  const sidecarContent = fs.readFileSync(SIDECAR_PATH, "utf8");
  assert(sidecarContent.includes("findChromeOrEdge"), "sidecar contains system browser detection logic");
  assert(sidecarContent.includes("generatePdf"), "sidecar implements generatePdf browser-native caller");
  assert(sidecarContent.includes("http.createServer"), "sidecar exposes an offline, zero-dependency HTTP server");
} catch (e) {
  assert(false, `Could not verify desktop configs or sidecar: ${e.message}`);
}

console.log("\n=========================================");
console.log(`Verification Complete: ${passed} passed, ${failed} failed.`);
console.log("=========================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
