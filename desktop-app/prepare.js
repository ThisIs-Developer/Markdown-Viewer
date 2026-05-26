#!/usr/bin/env node

/**
 * prepare.js — Build script for the Neutralinojs desktop app.
 *
 * Copies shared browser-version files (script.js, styles.css, assets/)
 * from the repo root into desktop-app/resources/, downloads all remote CDN
 * libraries locally for 100% offline capabilities, and generates a
 * Neutralinojs-compatible index.html.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT_DIR = path.resolve(__dirname, "..");
const RESOURCES_DIR = path.resolve(__dirname, "resources");
const jsDest = path.join(RESOURCES_DIR, "js");
const LIBS_DIR = path.join(RESOURCES_DIR, "libs");

// Create directories
fs.mkdirSync(jsDest, { recursive: true });
fs.mkdirSync(LIBS_DIR, { recursive: true });

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy shared assets
fs.copyFileSync(path.join(ROOT_DIR, "script.js"), path.join(jsDest, "script.js"));
console.log("✓ Copied script.js → resources/js/script.js");

fs.copyFileSync(path.join(ROOT_DIR, "styles.css"), path.join(RESOURCES_DIR, "styles.css"));
console.log("✓ Copied styles.css → resources/styles.css");

copyDirSync(path.join(ROOT_DIR, "assets"), path.join(RESOURCES_DIR, "assets"));
console.log("✓ Copied assets/ → resources/assets/");

// Download helper
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
      resolve();
      return;
    }
    console.log(`Downloading offline dependency: ${path.basename(destPath)}...`);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to load ${url} (${res.statusCode})`));
        return;
      }
      const stream = fs.createWriteStream(destPath);
      res.pipe(stream);
      stream.on("finish", () => {
        stream.close();
        resolve();
      });
    }).on("error", reject);
  });
}

async function prepareOfflineDependencies() {
  console.log("\nStarting Offline Assets Preparation...");
  let html = fs.readFileSync(path.join(ROOT_DIR, "index.html"), "utf-8");
  const scriptJS = fs.readFileSync(path.join(ROOT_DIR, "script.js"), "utf-8");
  
  // Find all CDN script and link tags in HTML
  const cdnRegex = /(href|src)="(https:\/\/(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\/[^"]+)"/g;
  let match;
  const downloads = [];
  const replacements = [];
  const foundUrls = new Set();

  while ((match = cdnRegex.exec(html)) !== null) {
    const attr = match[1];
    const url = match[2];
    foundUrls.add(url);
    
    // Determine local filename - sanitize package version tags or query strings
    const urlPath = new URL(url).pathname;
    let filename = path.basename(urlPath);
    if (url.includes("bootstrap-icons")) {
      filename = "bootstrap-icons.min.css";
    }
    
    const localDest = path.join(LIBS_DIR, filename);
    downloads.push(downloadFile(url, localDest));
    
    // Queue replacement in HTML to point to local libs folder
    replacements.push({
      original: `${attr}="${url}"`,
      replaced: `${attr}="/libs/${filename}"`
    });
  }

  // Also find all CDN URLs inside script.js and download them for offline use
  const urlRegex = /https:\/\/(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\/[^'\s`"]+/g;
  while ((match = urlRegex.exec(scriptJS)) !== null) {
    const url = match[0];
    if (foundUrls.has(url)) continue;
    foundUrls.add(url);

    const urlPath = new URL(url).pathname;
    const filename = path.basename(urlPath);
    const localDest = path.join(LIBS_DIR, filename);
    downloads.push(downloadFile(url, localDest));
  }

  // Also download the relative fonts loaded by bootstrap-icons
  const fontDir = path.join(LIBS_DIR, "fonts");
  fs.mkdirSync(fontDir, { recursive: true });
  downloads.push(downloadFile("https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/fonts/bootstrap-icons.woff2", path.join(fontDir, "bootstrap-icons.woff2")));
  downloads.push(downloadFile("https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/fonts/bootstrap-icons.woff", path.join(fontDir, "bootstrap-icons.woff")));

  // Wait for all downloads to finish
  try {
    await Promise.all(downloads);
    console.log("✓ All offline libraries successfully prepared.");
  } catch (err) {
    console.warn("⚠ Failed to bundle some dependencies offline. Fallback to CDNs will occur.", err.message);
  }

  // Apply replacements in HTML
  replacements.forEach(rep => {
    html = html.replace(rep.original, rep.replaced);
  });

  // Fix relative assets
  html = html.replace(/href="assets\//g, 'href="/assets/');
  html = html.replace(/href="styles\.css"/g, 'href="/styles.css"');
  
  // Inject Neutralino script tags
  html = html.replace(
    /<script\s+src="script\.js"\s*><\/script>/i,
    '<script src="/js/neutralino.js"></script>\n    <script src="/js/main.js"></script>\n    <script src="/js/script.js"></script>',
  );

  // Inject app-info element
  html = html.replace(
    '<div class="app-container">',
    `<div class="app-container">
        <div id="neutralino-app">
          <div id="neutralino-info"></div>
        </div>`,
  );

  fs.writeFileSync(path.join(RESOURCES_DIR, "index.html"), html, "utf-8");
  console.log("✓ Generated resources/index.html (Offline replacements & injections applied)");
  console.log("\nDone! Run `npm run dev` to start the desktop app.");
}

prepareOfflineDependencies().catch(console.error);
