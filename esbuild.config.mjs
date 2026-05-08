import esbuild from "esbuild";
import process from "process";

const isProduction = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    "node:fs",
    "node:fs/promises",
    "node:path",
    "node:child_process",
    "node:os",
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  minify: isProduction,
  legalComments: isProduction ? "none" : "inline",
  sourcemap: isProduction ? false : "inline",
  treeShaking: true,
  outfile: "main.js"
});

if (isProduction) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
