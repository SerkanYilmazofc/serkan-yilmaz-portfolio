import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, "_tmp_airhockey.html");
const outDir = path.join(root, "public", "games", "air-hockey");
fs.mkdirSync(outDir, { recursive: true });

const c = fs.readFileSync(src, "utf8");
const styleStart = c.indexOf("<style>") + 7;
const styleEnd = c.indexOf("</style>");
const htmlStart = c.indexOf('<div id="outer">');
const scriptTag = c.indexOf('<script id="rendered-js"');
const jsStart = c.indexOf(">", scriptTag) + 1;
const jsEnd = c.lastIndexOf("</script>");

const css = c.slice(styleStart, styleEnd);
const body = c.slice(htmlStart, scriptTag).trim();
let js = c.slice(jsStart, jsEnd).trim();

// Escape hatch: parent can close overlay
js += `

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    try { parent.postMessage({ type: "airhockey-close" }, "*"); } catch (_) {}
  }
});
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Air Hockey</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;500;600;700&display=swap" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
  <style>
${css}
html, body {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #050505;
}
#airhockey-close {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 9999;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(255,255,255,0.25);
  background: rgba(0,0,0,0.55);
  color: #fff;
  font-size: 22px;
  cursor: pointer;
  backdrop-filter: blur(8px);
}
#airhockey-close:hover { background: rgba(255,255,255,0.12); }
  </style>
</head>
<body>
  <button type="button" id="airhockey-close" aria-label="Close">×</button>
${body}
  <script>
${js}
document.getElementById("airhockey-close").addEventListener("click", () => {
  try { parent.postMessage({ type: "airhockey-close" }, "*"); } catch (_) {}
});
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(outDir, "index.html"), page, "utf8");
console.log("Wrote", path.join(outDir, "index.html"), page.length);
