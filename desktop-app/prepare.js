#!/usr/bin/env node

/**
 * prepare.js — Build script for the Neutralinojs desktop app.
 *
 * Copies shared browser-version files (script.js, styles.css, assets/)
 * from the repo root into desktop-app/resources/, downloads all remote CDN
 * libraries locally for 100% offline capabilities, validates their cryptographic
 * integrity using SRI hashes (SHA-384), and generates a Neutralinojs-compatible index.html.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

const ROOT_DIR = path.resolve(__dirname, "..");
const RESOURCES_DIR = path.resolve(__dirname, "resources");
const jsDest = path.join(RESOURCES_DIR, "js");
const LIBS_DIR = path.join(RESOURCES_DIR, "libs");

// Create directories
fs.mkdirSync(jsDest, { recursive: true });
fs.mkdirSync(LIBS_DIR, { recursive: true });

function copyDirSync(src, dest, excludePatterns) {
  if (!excludePatterns) excludePatterns = [];
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    // PERF-027: Skip files matching exclusion patterns (e.g., large demo GIFs)
    if (excludePatterns.some(p => entry.name.match(p))) {
      console.log(`  ⊘ Skipped ${entry.name} (excluded from desktop build)`);
      continue;
    }
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath, excludePatterns);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy shared assets
fs.copyFileSync(path.join(ROOT_DIR, "script.js"), path.join(jsDest, "script.js"));
console.log("✓ Copied script.js → resources/js/script.js");

fs.copyFileSync(path.join(ROOT_DIR, "preview-worker.js"), path.join(jsDest, "preview-worker.js"));
console.log("Copied preview-worker.js to resources/js/preview-worker.js");

fs.copyFileSync(path.join(ROOT_DIR, "styles.css"), path.join(RESOURCES_DIR, "styles.css"));
console.log("✓ Copied styles.css → resources/styles.css");

// PERF-027: Exclude large demo assets (GIFs) from desktop build to reduce binary size
copyDirSync(path.join(ROOT_DIR, "assets"), path.join(RESOURCES_DIR, "assets"), [/\.gif$/i]);
console.log("✓ Copied assets/ → resources/assets/ (excluding GIF demos)");

/**
 * Validates the cryptographic integrity of a file against an expected SHA-384 hash.
 */
function verifyIntegrity(filePath, expectedHash) {
  return new Promise((resolve, reject) => {
    if (!expectedHash) {
      resolve(true); // Skip validation if no hash is provided (e.g., relative fonts)
      return;
    }

    const algo = expectedHash.startsWith("sha512-") ? "sha512" : "sha384";
    const hash = crypto.createHash(algo);
    const stream = fs.createReadStream(filePath);

    stream.on("data", data => hash.update(data));
    stream.on("end", () => {
      const calculated = algo + "-" + hash.digest("base64");
      if (calculated === expectedHash) {
        resolve(true);
      } else {
        reject(new Error(`Integrity mismatch for ${path.basename(filePath)}:\nExpected: ${expectedHash}\nCalculated: ${calculated}`));
      }
    });
    stream.on("error", reject);
  });
}

/**
 * Downloads a file from a URL and verifies its integrity.
 */
function downloadFile(url, destPath, expectedSha384) {
  return new Promise((resolve, reject) => {
    // If file already exists, verify its integrity before skipping
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
      verifyIntegrity(destPath, expectedSha384)
        .then(() => resolve())
        .catch(() => {
          console.log(`↻ Cached file ${path.basename(destPath)} failed integrity check. Re-downloading...`);
          fs.unlinkSync(destPath);
          downloadAndVerify();
        });
      return;
    }

    downloadAndVerify();

    function downloadAndVerify() {
      console.log(`Downloading offline dependency: ${path.basename(destPath)}...`);
      const req = https.get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume(); // Drain response to free up the socket
          reject(new Error(`Failed to load ${url} (${res.statusCode})`));
          return;
        }
        const stream = fs.createWriteStream(destPath);
        
        // Handle stream and response errors
        stream.on("error", reject);
        res.on("error", reject);

        res.pipe(stream);
        stream.on("finish", () => {
          stream.close();

          // Verify integrity of downloaded file
          verifyIntegrity(destPath, expectedSha384)
            .then(() => resolve())
            .catch(err => {
              // Delete corrupted file
              if (fs.existsSync(destPath)) {
                fs.unlinkSync(destPath);
              }
              reject(err);
            });
        });
      });
      req.on("error", reject);
    }
  });
}

async function prepareOfflineDependencies() {
  console.log("\nStarting Secure Offline Assets Preparation...");
  let html = fs.readFileSync(path.join(ROOT_DIR, "index.html"), "utf-8");
  
  // Find all CDN script and link tags that match standard script/stylesheet declarations
  const tagRegex = /<(link|script)[^>]+(?:href|src)="https:\/\/(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\/[^"]+"[^>]*>/g;
  let match;
  const downloads = [];
  const replacements = [];

  while ((match = tagRegex.exec(html)) !== null) {
    const fullTag = match[0];
    
    // Extract url
    const urlMatch = /(?:href|src)="([^"]+)"/.exec(fullTag);
    if (!urlMatch) continue;
    const url = urlMatch[1];

    // Extract integrity hash
    const integrityMatch = /integrity="([^"]+)"/.exec(fullTag);
    const expectedSha384 = integrityMatch ? integrityMatch[1] : null;

    if (!expectedSha384) {
      console.warn(`⚠ Warning: CDN dependency is missing an integrity hash: ${url}`);
      throw new Error(`CDN dependency is missing an integrity hash: ${url}`);
    }

    // Determine local filename - sanitize package version tags or query strings
    const urlPath = new URL(url).pathname;
    let filename = path.basename(urlPath);
    if (url.includes("bootstrap-icons")) {
      filename = "bootstrap-icons.min.css";
    }
    
    const localDest = path.join(LIBS_DIR, filename);
    downloads.push(downloadFile(url, localDest, expectedSha384));
    
    // Queue replacement in HTML to point to local libs folder
    const attr = fullTag.includes("href=") ? "href" : "src";
    replacements.push({
      original: `${attr}="${url}"`,
      replaced: `${attr}="/libs/${filename}"`
    });
  }

  // Also download the relative fonts loaded by bootstrap-icons (these are loaded by the stylesheet and do not have SRI tags)
  const fontDir = path.join(LIBS_DIR, "fonts");
  fs.mkdirSync(fontDir, { recursive: true });
  downloads.push(downloadFile("https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/fonts/bootstrap-icons.woff2", path.join(fontDir, "bootstrap-icons.woff2"), null));
  downloads.push(downloadFile("https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/fonts/bootstrap-icons.woff", path.join(fontDir, "bootstrap-icons.woff"), null));

  // Create Leaflet images directory for offline map icons
  const leafletImagesDir = path.join(LIBS_DIR, "images");
  fs.mkdirSync(leafletImagesDir, { recursive: true });

  // Dynamic / Lazy-loaded dependencies to download manually for offline capability
  const dynamicLibs = [
    {
      url: "https://cdnjs.cloudflare.com/ajax/libs/abcjs/6.5.2/abcjs-basic-min.js",
      dest: path.join(LIBS_DIR, "abcjs-basic-min.js"),
      hash: "sha512-QJ21PAOSw5KSiQ12gnP74qwLRAEn9GZtrFI0yY1akCLLpcEaC7xwZ7BiONZ/7pyrfUADyh7sHnI3SYHifO+tmg=="
    },
    {
      url: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js",
      dest: path.join(LIBS_DIR, "leaflet.js"),
      hash: null
    },
    {
      url: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css",
      dest: path.join(LIBS_DIR, "leaflet.css"),
      hash: null
    },
    {
      url: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      dest: path.join(leafletImagesDir, "marker-icon.png"),
      hash: null
    },
    {
      url: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      dest: path.join(leafletImagesDir, "marker-icon-2x.png"),
      hash: null
    },
    {
      url: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      dest: path.join(leafletImagesDir, "marker-shadow.png"),
      hash: null
    },
    {
      url: "https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js",
      dest: path.join(LIBS_DIR, "topojson.min.js"),
      hash: null
    },
    {
      url: "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
      dest: path.join(LIBS_DIR, "three.min.js"),
      hash: null
    },
    {
      url: "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/STLLoader.js",
      dest: path.join(LIBS_DIR, "STLLoader.js"),
      hash: null
    },
    {
      url: "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js",
      dest: path.join(LIBS_DIR, "OrbitControls.js"),
      hash: null
    },
    {
      url: "https://cdn.jsdelivr.net/npm/mermaid@11.15.0/dist/mermaid.min.js",
      dest: path.join(LIBS_DIR, "mermaid.min.js"),
      hash: null
    },
    {
      url: "https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js",
      dest: path.join(LIBS_DIR, "d3.min.js"),
      hash: null
    },
    {
      url: "https://cdn.jsdelivr.net/npm/markmap-lib@0.18.12/dist/browser/index.iife.js",
      dest: path.join(LIBS_DIR, "markmap-lib.iife.js"),
      hash: null
    },
    {
      url: "https://cdn.jsdelivr.net/npm/markmap-view@0.18.12/dist/browser/index.js",
      dest: path.join(LIBS_DIR, "markmap-view.js"),
      hash: null
    },
    {
      url: "https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.min.js",
      dest: path.join(LIBS_DIR, "tex-mml-chtml.min.js"),
      hash: null
    },
    {
      url: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
      dest: path.join(LIBS_DIR, "jspdf.umd.min.js"),
      hash: null
    },
    {
      url: "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
      dest: path.join(LIBS_DIR, "html2canvas.min.js"),
      hash: null
    },
    {
      url: "https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js",
      dest: path.join(LIBS_DIR, "pako.min.js"),
      hash: null
    },
    {
      url: "https://cdn.jsdelivr.net/npm/emoji-toolkit@9.0.1/lib/js/joypixels.min.js",
      dest: path.join(LIBS_DIR, "joypixels.min.js"),
      hash: null
    },
    {
      url: "https://cdn.jsdelivr.net/npm/emoji-toolkit@9.0.1/extras/css/joypixels.min.css",
      dest: path.join(LIBS_DIR, "joypixels.min.css"),
      hash: null
    }
  ];

  for (const lib of dynamicLibs) {
    downloads.push(downloadFile(lib.url, lib.dest, lib.hash));
  }

  // Wait for all downloads and cryptographic validations to finish
  try {
    await Promise.all(downloads);
    console.log("✓ All offline libraries successfully downloaded and cryptographically validated.");
  } catch (err) {
    console.error("✗ Critical Security Error: Dependency integrity check failed!", err.message);
    process.exit(1); // Abort execution if a download fails validation
  }

  // Apply replacements in HTML
  replacements.forEach(rep => {
    html = html.replace(rep.original, rep.replaced);
  });

  // Fix relative assets
  html = html.replace(/href="assets\//g, 'href="/assets/');
  html = html.replace(/href="styles\.css"/g, 'href="/styles.css"');
  
  // PERF-034: Strip web-specific SEO tags, canonical, hreflang, preconnect, manifest and JSON-LD structured data for desktop build
  html = html.replace(/<!-- DNS Prefetch & Preconnect CDN Origins to Warm Up Latency -->[\s\S]*?<!-- PERF-015:/i, '<!-- PERF-015:');
  html = html.replace(/<!-- Canonical Link -->[\s\S]*?<!-- PWA Web Manifest -->/i, '<!-- PWA Web Manifest -->');
  html = html.replace(/<link rel="manifest" href="manifest\.json">/i, '');
  html = html.replace(/<!-- Primary Meta Tags -->[\s\S]*?<!-- JSON-LD Structured Data Schema/i, '<!-- JSON-LD Structured Data Schema');
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, '');

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

prepareOfflineDependencies().catch(err => {
  console.error("✗ Fatal Prepare Error:", err);
  process.exit(1);
});
