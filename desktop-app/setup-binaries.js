#!/usr/bin/env node

/**
 * setup-binaries.js - Idempotent Neutralinojs binary setup.
 *
 * Ensures the bin/ folder contains platform binaries matching the version
 * pinned in neutralino.config.json (cli.binaryVersion). Downloads them
 * via `neu update` when missing, when the pinned version changes, or when
 * the generated Neutralino client library is missing.
 *
 * A version marker (bin/.version) tracks the installed binary version so that
 * repeated builds and dev runs skip unnecessary downloads.
 *
 * Run from the desktop-app/ directory:
 *   node setup-binaries.js
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const CONFIG_FILE = path.resolve(__dirname, "neutralino.config.json");
const BIN_DIR = path.resolve(__dirname, "bin");
const VERSION_MARKER = path.join(BIN_DIR, ".version");

/** Neu CLI package - same version used across all npm scripts */
const NEU_CLI = "@neutralinojs/neu@11.7.0";

const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
const expectedVersion = config.cli.binaryVersion;
const clientLibraryPath = path.resolve(
  __dirname,
  config.cli.clientLibrary.replace(/^\/+/, ""),
);

if (!expectedVersion) {
  console.error("Error: cli.binaryVersion not set in neutralino.config.json");
  process.exit(1);
}

/** Check if binaries and the generated client library already match the config */
if (fs.existsSync(VERSION_MARKER)) {
  const installed = fs.readFileSync(VERSION_MARKER, "utf-8").trim();
  if (installed === expectedVersion && fs.existsSync(clientLibraryPath)) {
    console.log(
      `Neutralinojs binaries v${expectedVersion} already present - skipping download`,
    );
    process.exit(0);
  }
  if (installed !== expectedVersion) {
    console.log(
      `Version changed (${installed} -> ${expectedVersion}) - re-downloading`,
    );
  } else {
    console.log("Neutralinojs client library missing - re-running update");
  }
}

/** Download binaries + client library via neu update */
console.log(`Downloading Neutralinojs v${expectedVersion} binaries...`);
execSync(`npx -y ${NEU_CLI} update`, {
  cwd: __dirname,
  stdio: "inherit",
});

/** Write version marker so subsequent runs are no-ops */
fs.mkdirSync(BIN_DIR, { recursive: true });
fs.writeFileSync(VERSION_MARKER, expectedVersion, "utf-8");
console.log(`Neutralinojs binaries v${expectedVersion} ready`);
