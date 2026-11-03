#!/usr/bin/env node

/**
 * Build each Neutralino target as a self-contained executable.
 *
 * Embedding every target in one neu invocation can exhaust Node.js's heap when
 * the application has many offline resources. Each target is therefore built
 * separately, then copied into one flat dist/markdown-viewer directory.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const APP_DIR = __dirname;
const BIN_DIR = path.join(APP_DIR, "bin");
const CONFIG_FILE = path.join(APP_DIR, "neutralino.config.json");
const DIST_DIR = path.join(APP_DIR, "dist");
const FINAL_DIR = path.join(DIST_DIR, "markdown-viewer");
const TEMP_BUILD_ROOT = path.join(DIST_DIR, ".standalone-build");
const NEU_CLI = "@neutralinojs/neu@11.7.0";

const TARGETS = [
  "linux_arm64",
  "linux_armhf",
  "linux_x64",
  "mac_arm64",
  "mac_universal",
  "mac_x64",
  "win_x64.exe",
].map((platform) => ({
  sourceName: `neutralino-${platform}`,
  outputName: `markdown-viewer-${platform}`,
  buildKey: platform.replace(/\.exe$/, ""),
}));

function createConfigOverride(distributionPath, buildKey) {
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  config.cli = config.cli || {};
  config.cli.distributionPath = path
    .relative(APP_DIR, distributionPath)
    .replace(/\\/g, "/");

  const tmpDir = path.join(APP_DIR, ".tmp");
  fs.mkdirSync(tmpDir, { recursive: true });
  const configFile = path.join(
    tmpDir,
    `neutralino.${buildKey}.${process.pid}.config.json`,
  );
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
  return configFile;
}

function hideOtherBinaries(selectedSourceName, holdingDir) {
  const hidden = [];
  fs.mkdirSync(holdingDir, { recursive: true });

  for (const entry of fs.readdirSync(BIN_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.startsWith("neutralino-")) continue;
    if (entry.name === selectedSourceName) continue;

    const from = path.join(BIN_DIR, entry.name);
    const to = path.join(holdingDir, entry.name);
    fs.renameSync(from, to);
    hidden.push({ from, to });
  }

  return hidden;
}

function restoreBinaries(hidden) {
  for (let i = hidden.length - 1; i >= 0; i -= 1) {
    const item = hidden[i];
    if (fs.existsSync(item.to)) {
      fs.renameSync(item.to, item.from);
    }
  }
}

async function buildTarget(target) {
  const sourcePath = path.join(BIN_DIR, target.sourceName);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing ${target.sourceName}. Run npm run setup first.`);
  }

  const targetDist = path.join(TEMP_BUILD_ROOT, target.buildKey);
  const holdingDir = path.join(
    BIN_DIR,
    `.non-target-disabled-${target.buildKey}-${process.pid}`,
  );
  const configFile = createConfigOverride(targetDist, target.buildKey);
  const hidden = hideOtherBinaries(target.sourceName, holdingDir);

  try {
    console.log(`\nBuilding standalone ${target.outputName}...`);
    const result = spawnSync(
      "npx",
      [
        "-y",
        NEU_CLI,
        "build",
        "--embed-resources",
        "--clean",
        "--config-file",
        configFile,
      ],
      {
        cwd: APP_DIR,
        stdio: "inherit",
        env: process.env,
        shell: process.platform === "win32",
      },
    );

    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`${target.outputName} build exited with code ${result.status}`);
    }

    const builtFile = path.join(
      targetDist,
      "markdown-viewer",
      target.outputName,
    );
    if (!fs.existsSync(builtFile)) {
      throw new Error(`Build succeeded but ${target.outputName} was not generated.`);
    }

    const finalFile = path.join(FINAL_DIR, target.outputName);
    fs.copyFileSync(builtFile, finalFile);
    if (target.outputName.endsWith(".exe")) await require("./experimental/windows/brand-executable").brandExecutable(finalFile);
    fs.chmodSync(finalFile, 0o755);
  } finally {
    restoreBinaries(hidden);
    fs.rmSync(holdingDir, { recursive: true, force: true });
    fs.rmSync(configFile, { force: true });
  }
}

async function main() {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(FINAL_DIR, { recursive: true });

  try {
    for (const target of TARGETS) await buildTarget(target);
  } finally {
    fs.rmSync(TEMP_BUILD_ROOT, { recursive: true, force: true });
  }

  const outputs = fs.readdirSync(FINAL_DIR).sort();
  if (outputs.length !== TARGETS.length) {
    throw new Error(`Expected ${TARGETS.length} binaries, generated ${outputs.length}.`);
  }

  console.log(`\nGenerated ${outputs.length} standalone binaries in ${FINAL_DIR}:`);
  for (const output of outputs) console.log(`  ${output}`);
}

main().catch(error => {
  console.error(`\nStandalone build failed: ${error.message}`);
  process.exitCode = 1;
});
