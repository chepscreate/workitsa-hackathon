#!/usr/bin/env node
/**
 * Next.js 16 static-export workaround.
 *
 * The App Router's client runtime fetches per-segment RSC prefetch payloads
 * at URLs like:
 *     /post-a-job/__next.post-a-job.__PAGE__.txt
 *
 * But `next build && next export` (output: "export") writes those same
 * payloads to subdirectories:
 *     /post-a-job/__next.post-a-job/__PAGE__.txt
 *
 * Firebase Hosting serves files literally — so every page-prefetch 404s,
 * spamming the console and falling back to slow full-page navigation.
 *
 * This script walks the `out/` directory after the build and copies each
 *     <parent>/<dir>/<file>
 * to a flat dotted twin
 *     <parent>/<dir>.<file>
 * for any `<dir>` that starts with `__next.`. Both naming conventions
 * exist side-by-side so Firebase Hosting can serve whichever the runtime
 * happens to ask for. Cheap, idempotent, ~10 KB extra per page.
 *
 * Drop this script if/when Next.js fixes the static-export naming upstream.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, "..", "out");

async function walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const results = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // Recurse first so children are processed before we (maybe) flatten the parent.
      results.push(...(await walk(full)));
      results.push({ kind: "dir", path: full, name: e.name });
    } else {
      results.push({ kind: "file", path: full, name: e.name });
    }
  }
  return results;
}

async function main() {
  const entries = await walk(OUT_DIR);
  let copied = 0;

  // For every directory named `__next.*`, take each file inside and copy it
  // to a sibling at `<parent>/<dir>.<file>`. So e.g.
  //     post-a-job/__next.post-a-job/__PAGE__.txt
  // gets copied to
  //     post-a-job/__next.post-a-job.__PAGE__.txt
  for (const entry of entries) {
    if (entry.kind !== "dir") continue;
    if (!entry.name.startsWith("__next.")) continue;

    const parent = path.dirname(entry.path);
    const children = await fs.readdir(entry.path, { withFileTypes: true });
    for (const child of children) {
      if (!child.isFile()) continue;
      const src = path.join(entry.path, child.name);
      const dst = path.join(parent, `${entry.name}.${child.name}`);
      try {
        await fs.copyFile(src, dst);
        copied++;
      } catch (err) {
        console.warn(`[flatten-rsc] copy failed for ${src} -> ${dst}`, err);
      }
    }
  }

  console.log(`[flatten-rsc] copied ${copied} RSC prefetch payload(s) to flat names.`);
}

main().catch((err) => {
  console.error("[flatten-rsc] failed:", err);
  process.exitCode = 1;
});
