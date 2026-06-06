const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const PORT_FILE = path.join(__dirname, "..", "..", ".pdf_exporter_port");

// Helper to find Chrome or Edge installation path
function findChromeOrEdge() {
  const platform = process.platform;
  let paths = [];

  if (platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || "";
    const programFiles = process.env.PROGRAMFILES || "C:\\Program Files";
    const programFilesX86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
    
    paths = [
      path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    ];
  } else if (platform === "darwin") {
    paths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
  } else {
    // Linux
    paths = [
      "/usr/bin/google-chrome",
      "/usr/bin/chrome",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    ];
  }

  for (const p of paths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

// Write the temp HTML file, execute Chrome/Edge to generate PDF, and delete temp HTML
function generatePdf(html, outputPath, callback) {
  const chromePath = findChromeOrEdge();
  if (!chromePath) {
    return callback(new Error("Chromium-compatible browser (Chrome or Edge) not found. Please install Chrome or Edge."));
  }

  const tempHtmlPath = path.join(__dirname, `temp_export_${Date.now()}.html`);
  
  // Write html content to temp file
  fs.writeFile(tempHtmlPath, html, "utf8", (err) => {
    if (err) return callback(err);

    const args = [
      "--headless",
      "--disable-gpu",
      "--no-pdf-header-footer",
      `--print-to-pdf=${outputPath}`,
      tempHtmlPath
    ];

    execFile(chromePath, args, (execErr, stdout, stderr) => {
      // Clean up temp HTML file
      fs.unlink(tempHtmlPath, () => {});

      if (execErr) {
        return callback(new Error(`Browser execution failed: ${execErr.message}\nStderr: ${stderr}`));
      }
      callback(null);
    });
  });
}

// Start HTTP server on a random port
const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/export") {
    let body = "";
    req.on("data", chunk => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const { html, outputPath } = payload;

        if (!html || !outputPath) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing required fields: html and outputPath" }));
          return;
        }

        generatePdf(html, outputPath, (err) => {
          if (err) {
            console.error("PDF generation error:", err);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message }));
          } else {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));
          }
        });
      } catch (parseErr) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON payload" }));
      }
    });
  } else {
    res.writeHead(444);
    res.end();
  }
});

// Bind to random port
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  const port = address.port;
  console.log(`PDF Exporter Extension listening on port ${port}`);

  // Write port to file
  try {
    fs.writeFileSync(PORT_FILE, String(port), "utf8");
    console.log(`Port written to ${PORT_FILE}`);
  } catch (err) {
    console.error(`Failed to write port file: ${err.message}`);
  }
});

// Clean up port file on exit
function cleanup() {
  try {
    if (fs.existsSync(PORT_FILE)) {
      fs.unlinkSync(PORT_FILE);
      console.log("Port file cleaned up.");
    }
  } catch (e) {}
  process.exit();
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
