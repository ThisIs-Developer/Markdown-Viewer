# Desktop Application Guide

This page describes the architecture, development setup, build options, and platform installation procedures for the desktop version of **Markdown Viewer** (v3.8.0), powered by the **Neutralinojs** runtime framework.

---

## Table of Contents

- [Overview](#overview)
- [Workspace Directory Structure](#workspace-directory-structure)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Running in Hot-Reload Dev Mode](#running-in-hot-reload-dev-mode)
- [Building the Application](#building-the-application)
- [Build Output Configurations](#build-output-configurations)
- [Building with Docker Containerization](#building-with-docker-containerization)
- [Platform-Specific Installation Guidelines](#platform-specific-installation-guidelines)
  - [Windows](#windows)
  - [Linux](#linux)
  - [macOS](#macos)

---

## Overview

The desktop version of Markdown Viewer wraps the core web application (HTML, CSS, JS) inside a lightweight native OS webview container using the **Neutralinojs** framework. 

### Why Neutralinojs?
*   **Minimal Footprint:** Unlike Electron, which bundles a full Chromium browser and Node.js instance, Neutralinojs uses the system's built-in webview. This results in an executable size of less than 15 MB (compared to 150+ MB for Electron).
*   **Low Resource Usage:** Idle memory usage is typically under 50 MB.
*   **Shared Codebase:** The desktop app uses the exact same core files (`script.js`, `styles.css`, `assets/`) as the web application.

---

## Workspace Directory Structure

The `desktop-app` directory contains the configuration files and build scripts for the desktop version:

```
desktop-app/
├── package.json              # Contains npm build scripts
├── neutralino.config.json    # Configures Neutralino window size, titles, and API permissions
├── setup-binaries.js         # Script to download Neutralino binaries for target platforms
├── prepare.js                # Copies core files from the root folder into the resources folder
└── resources/                # Assets packaged into the desktop application
    ├── index.html            # Compiled template page
    ├── styles.css            # Stylesheet copied from the root folder
    ├── js/
    │   ├── main.js           # Handles desktop lifecycle events and tray menus
    │   ├── script.js         # Copied from the root folder
    │   └── neutralino.js     # Neutralino client API library
    └── assets/               # Image assets copied from the root folder
```

---

## Prerequisites

To compile the desktop application from source, you will need:
*   **Node.js** (v16.0.0 or later) and **npm** (installed automatically with Node).
*   **An active internet connection** (only required during the initial setup to download Neutralino runtimes).

---

## Local Development Setup

To set up the desktop project directory locally:

1.  Open your terminal and navigate to the `desktop-app` folder:
    ```bash
    cd Markdown-Viewer/desktop-app
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Download the required Neutralino framework binaries for Windows, Linux, and macOS:
    ```bash
    node setup-binaries.js
    ```
4.  Copy the latest frontend code from the repository root into the desktop build resources folder:
    ```bash
    node prepare.js
    ```

---

## Running in Hot-Reload Dev Mode

To run the application locally in development mode:

```bash
npm run dev
```

This starts the desktop application in a new window. It enables a development server with **hot-reload**: edits to files in the `resources/` folder will immediately update the running application without requiring a manual rebuild.

---

## Building the Application

You can package the application in three ways:

### 1. Embedded Binary (Recommended for Windows)
This builds a single, self-contained Windows executable file that has all application resources embedded inside the binary:
```bash
npm run build
```

### 2. Portable Distribution
This builds the application with the binary and a separate `resources.neu` file. This is standard for multi-platform distributions:
```bash
npm run build:portable
```

### 3. Build All Formats
This compiles both the portable distribution ZIP file and the embedded Windows executable:
```bash
npm run build:all
```

---

## Build Output Configurations

Compiled files are placed in the `desktop-app/dist/` directory:

```
dist/
├── markdown-viewer/                         # Contains portable binaries
├── markdown-viewer-release.zip              # Compressed portable distribution
└── windows-embedded/
    └── markdown-viewer/
        └── markdown-viewer-win_x64.exe      # Single-file Windows binary
```

---

## Building with Docker Containerization

To package the application without installing Node.js locally, use the provided Docker Compose configuration to compile the binaries inside a container:

```bash
# Run from the desktop-app folder
docker compose up --build
```

The container downloads the required binaries, runs the build scripts, and saves the output to the host system's `dist/` directory using a volume mount.

---

## Platform-Specific Installation Guidelines

### Windows
*   **Installation:** No installer is needed. Run `markdown-viewer-win_x64.exe` directly.
*   **SmartScreen Warning:** Because the executable is unsigned, Windows SmartScreen may display a warning on first launch. Click **More info**, then select **Run anyway** to launch the application.

### Linux
Make the binary executable before running it:
```bash
chmod +x markdown-viewer-linux_x64
./markdown-viewer-linux_x64
```

### macOS
macOS blocks unsigned binaries by default. To run the app, clear the quarantine flag and make the file executable:

```bash
# Remove the macOS quarantine flag
xattr -d com.apple.quarantine markdown-viewer-mac_universal

# Grant execution permissions
chmod +x markdown-viewer-mac_universal

# Run the app
./markdown-viewer-mac_universal
```

Alternatively, right-click the app binary in Finder, click **Open**, and select **Open** in the confirmation dialog.
