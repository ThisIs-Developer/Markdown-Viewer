// Markdown Viewer Desktop — Neutralino.js integration layer
// Handles system tray, window close confirmation, and file association

/*
    Function to set up a system tray menu with options specific to the window mode.
    This function checks if the application is running in window mode, and if so,
    it defines the tray menu items and sets up the tray accordingly.
*/
function setTray() {
  // Tray menu is only available in window mode
  if (typeof NL_MODE === "undefined" || NL_MODE != "window") {
    console.log("INFO: Tray menu is only available in the window mode.");
    return;
  }

  // Define tray menu items
  let tray = {
    icon: "/resources/assets/icon.jpg",
    menuItems: [
      { id: "VERSION", text: "Get version" },
      { id: "SEP", text: "-" },
      { id: "QUIT", text: "Quit" },
    ],
  };

  // Set the tray menu
  try {
    Neutralino.os.setTray(tray);
  } catch (e) {
    console.warn("Failed to set system tray:", e);
  }
}

/*
    Function to handle click events on the tray menu items.
    This function performs different actions based on the clicked item's ID,
    such as displaying version information or exiting the application.
*/
async function flushWorkspaceBeforeDesktopExit() {
  if (typeof window.MarkdownViewerFlushWorkspace === "function") {
    await window.MarkdownViewerFlushWorkspace();
  }
}

async function onTrayMenuItemClicked(event) {
  switch (event.detail.id) {
    case "VERSION":
      // Display version information
      Neutralino.os.showMessageBox(
        "Version information",
        `Neutralinojs server: v${NL_VERSION} | Neutralinojs client: v${NL_CVERSION}`,
      );
      break;
    case "QUIT":
      // Exit the application
      try {
        await flushWorkspaceBeforeDesktopExit();
      } catch (e) {
        console.warn("Failed to flush workspace before tray exit:", e);
        await Neutralino.os.showMessageBox(
          "Unable to exit safely",
          "Markdown Viewer could not save the latest workspace changes. The application will remain open so you can retry.",
          "OK",
          "ERROR"
        );
        return;
      }
      Neutralino.app.exit();
      break;
  }
}

async function onWindowClose() {
  try {
    let response = await Neutralino.os.showMessageBox(
      "Exit Markdown Viewer",
      "Are you sure you want to close the application? Any unsaved changes in your tabs may be lost.",
      "YES_NO",
      "QUESTION"
    );
    if (response === "YES") {
      try {
        await flushWorkspaceBeforeDesktopExit();
      } catch (e) {
        console.warn("Failed to flush workspace before window exit:", e);
        await Neutralino.os.showMessageBox(
          "Unable to exit safely",
          "Markdown Viewer could not save the latest workspace changes. The application will remain open so you can retry.",
          "OK",
          "ERROR"
        );
        return;
      }
      Neutralino.app.exit();
    }
  } catch (e) {
    console.warn("Window close handling failed; keeping the application open to protect unsaved work:", e);
    try {
      await Neutralino.os.showMessageBox(
        "Unable to exit safely",
        "Markdown Viewer could not verify that the workspace was saved. The application will remain open.",
        "OK",
        "ERROR"
      );
    } catch (_) {}
  }
}

function isNeutralinoRuntime() {
  if (typeof Neutralino === 'undefined' || typeof NL_PORT === 'undefined') {
    return false;
  }

  try {
    return typeof NL_TOKEN !== 'undefined' || Boolean(sessionStorage.getItem('NL_TOKEN'));
  } catch (e) {
    return typeof NL_TOKEN !== 'undefined';
  }
}

function getNeutralinoArguments() {
  if (typeof NL_ARGS === 'undefined') return [];
  if (Array.isArray(NL_ARGS)) return NL_ARGS;
  try {
    const parsed = JSON.parse(NL_ARGS);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

async function focusDesktopWindow() {
  try {
    if (Neutralino.window && typeof Neutralino.window.isMinimized === 'function' && await Neutralino.window.isMinimized()) {
      await Neutralino.window.unminimize();
    }
    if (Neutralino.window && typeof Neutralino.window.show === 'function') await Neutralino.window.show();
    if (Neutralino.window && typeof Neutralino.window.focus === 'function') await Neutralino.window.focus();
  } catch (error) {
    console.warn('Could not focus the existing Markdown Viewer window:', error);
  }
}

async function openExternalMarkdownFile(filePath, options) {
  if (typeof filePath !== 'string' || !/\.(md|markdown)$/i.test(filePath)) return;
  try {
    const stats = await Neutralino.filesystem.getStats(filePath);
    if (stats && Number(stats.size) > 10 * 1024 * 1024) {
      console.warn('External Markdown file exceeds the 10 MB limit:', filePath);
      return;
    }
    const content = await Neutralino.filesystem.readFile(filePath);
    const fileName = filePath.split(/[/\\]/).pop().replace(/\.(md|markdown)$/i, '');
    if (window.NL_IMPORT_EXTERNAL_FILE) {
      await Promise.resolve(window.NL_IMPORT_EXTERNAL_FILE(content, fileName, filePath));
    } else if (options && options.initial) {
      window.NL_INITIAL_FILE_CONTENT = { name: fileName, content: content, sourcePath: filePath };
    } else {
      window.NL_PENDING_EXTERNAL_FILES = window.NL_PENDING_EXTERNAL_FILES || [];
      window.NL_PENDING_EXTERNAL_FILES.push({ content: content, name: fileName, sourcePath: filePath });
    }
    await focusDesktopWindow();
  } catch (error) {
    console.warn('Could not open external Markdown file:', filePath, error);
  }
}

// PR #1852 delivers launches through the app connection, not a filesystem inbox.
// Register before init: launches can arrive before the editor is ready.
const desktopAppReady = new Promise(function(resolve) {
  window.addEventListener('markdown-viewer:ready', resolve, { once: true });
});
let secondInstanceQueue = Promise.resolve();

async function resolveLaunchMarkdownPaths(args, cwd) {
  const paths = [];
  for (const arg of args) {
    if (typeof arg !== 'string' || arg.startsWith('-') || !/\.(md|markdown)$/i.test(arg)) continue;
    let filePath = arg;
    if (!/^(?:[a-z]:[/\\]|[/\\]{2})/i.test(arg)) {
      // Drive-relative paths (C:notes.md) require per-drive cwd state we do not have.
      if (/^[a-z]:/i.test(arg) || !cwd) continue;
      if (/^[/\\]/.test(arg)) {
        const drive = /^[a-z]:/i.exec(cwd);
        if (!drive) continue;
        filePath = drive[0] + arg;
      } else {
        filePath = await Neutralino.filesystem.getJoinedPath(cwd, arg);
      }
    }
    paths.push(await Neutralino.filesystem.getNormalizedPath(filePath));
  }
  return paths;
}

function onDesktopSecondInstance(event) {
  const detail = event && event.detail;
  if (!detail || !Array.isArray(detail.args) || typeof detail.cwd !== 'string') return;
  secondInstanceQueue = secondInstanceQueue.then(async function() {
    await desktopAppReady;
    await initialFileLoad;
    const paths = await resolveLaunchMarkdownPaths(detail.args, detail.cwd);
    for (const filePath of paths) await openExternalMarkdownFile(filePath);
    if (!paths.length) await focusDesktopWindow();
  }).catch(function(error) {
    console.warn('Could not process the second-instance launch:', error);
  });
  return secondInstanceQueue;
}

async function onDesktopFilesDropped(event) {
  const detail = event && event.detail;
  const droppedItems = Array.isArray(detail)
    ? detail
    : (detail && Array.isArray(detail.files) ? detail.files : []);
  const paths = droppedItems.map(function(item) {
    if (typeof item === 'string') return item;
    if (item && typeof item.path === 'string') return item.path;
    if (item && typeof item.filePath === 'string') return item.filePath;
    return '';
  }).filter(Boolean);
  if (!paths.length || typeof window.NL_HANDLE_NATIVE_DROP !== 'function') return;
  await window.NL_HANDLE_NATIVE_DROP(paths);
  await focusDesktopWindow();
}

// Initialize Neutralino if in native environment
if (isNeutralinoRuntime()) {
  if (typeof NL_OS !== 'undefined' && NL_OS === 'Windows' &&
      window.MARKDOWN_VIEWER_DESKTOP_RUNTIME_FEATURES?.nativeSingleInstance === true) {
    Neutralino.events.on("secondInstance", onDesktopSecondInstance);
  }
  Neutralino.init();

  // Register event listeners
  Neutralino.events.on("trayMenuItemClicked", onTrayMenuItemClicked);
  Neutralino.events.on("windowClose", onWindowClose);
  if (typeof NL_OS !== 'undefined' && NL_OS === 'Windows' &&
      window.MARKDOWN_VIEWER_DESKTOP_RUNTIME_FEATURES?.nativeFileDrop === true) {
    Neutralino.events.on("filesDropped", onDesktopFilesDropped);
  }

  // Conditional initialization: Set up system tray if not running on macOS
  if (typeof NL_OS !== 'undefined' && NL_OS != "Darwin") {
    // TODO: Fix https://github.com/neutralinojs/neutralinojs/issues/615
    setTray();
  }

  window.addEventListener('markdown-viewer:ready', function() {
    if (typeof window.NL_START_LINKED_MONITORING === 'function') {
      window.NL_START_LINKED_MONITORING().catch(function(error) {
        console.warn('Linked source monitoring initialization failed:', error);
      });
    }
  }, { once: true });
}

// Open file passed as command-line argument (e.g. when double-clicking a .md file)
const initialFileLoad = (async function loadInitialFile() {
  if (!isNeutralinoRuntime()) return;
  const args = getNeutralinoArguments();
  if (typeof NL_OS !== 'undefined' && NL_OS === 'Windows' &&
      window.MARKDOWN_VIEWER_DESKTOP_RUNTIME_FEATURES?.nativeSingleInstance === true) {
    const paths = await resolveLaunchMarkdownPaths(args, typeof NL_CWD === 'string' ? NL_CWD : '');
    if (!paths.length) return;
    await desktopAppReady;
    for (const filePath of paths) await openExternalMarkdownFile(filePath);
    return;
  }
  const filePath = args.find(a => typeof a === 'string' && /\.(md|markdown)$/i.test(a));
  if (!filePath) return;
  await openExternalMarkdownFile(filePath, { initial: true });
})();
