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
    Neutralino.app.exit();
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

// Initialize Neutralino if in native environment
if (isNeutralinoRuntime()) {
  Neutralino.init();

  // Register event listeners
  Neutralino.events.on("trayMenuItemClicked", onTrayMenuItemClicked);
  Neutralino.events.on("windowClose", onWindowClose);

  // Conditional initialization: Set up system tray if not running on macOS
  if (typeof NL_OS !== 'undefined' && NL_OS != "Darwin") {
    // TODO: Fix https://github.com/neutralinojs/neutralinojs/issues/615
    setTray();
  }
}

// Open file passed as command-line argument (e.g. when double-clicking a .md file)
(async function loadInitialFile() {
  if (!isNeutralinoRuntime() || typeof NL_ARGS === 'undefined') return;
  const args = Array.isArray(NL_ARGS) ? NL_ARGS : (() => { try { return JSON.parse(NL_ARGS); } catch(e) { return []; } })();
  const filePath = args.find(a => typeof a === 'string' && /\.(md|markdown)$/i.test(a));
  if (!filePath) return;

  try {
    const content = await Neutralino.filesystem.readFile(filePath);
    const fileName = filePath.split(/[/\\]/).pop().replace(/\.(md|markdown)$/i, '');
    
    window.NL_INITIAL_FILE_CONTENT = {
      name: fileName,
      content: content
    };

    // Callback hook in case script.js loaded first
    if (window.NL_IMPORT_EXTERNAL_FILE) {
      window.NL_IMPORT_EXTERNAL_FILE(content, fileName);
    }
  } catch (e) {
    console.warn('Could not open initial file:', e);
  }
})();
