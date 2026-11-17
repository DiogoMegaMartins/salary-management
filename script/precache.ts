import { readdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const root = resolve("dist/public");
const assets = readdirSync(resolve(root, "assets")).filter(x => !x.endsWith(".map")).map(x => `assets/${x}`);
writeFileSync(resolve(root, "precache.json"), JSON.stringify(["index.html", "manifest.webmanifest", "favicon.svg", "icon-192.png", "icon-512.png", "icon-maskable-512.png", ...assets]));
const version = createHash("sha256").update(JSON.stringify(assets)).digest("hex").slice(0, 16);
writeFileSync(resolve(root, "sw.js"), readFileSync(resolve(root, "sw.js"), "utf8").replace("__SHELL_VERSION__", version));
