/**
 * Build-bust marker. Bump this string any time you need Firebase to
 * redeploy every function (for example, when the Node.js runtime version
 * changes in package.json). Every function file imports this — when the
 * value changes the bundle hash changes, so Firebase ships a fresh
 * deployment instead of "Skipped (no changes detected)".
 *
 * Last bumped: 2026-05-26 — forcing Node 20 → Node 22 runtime upgrade.
 */
export const RUNTIME_MARKER = "2026-05-27-node22-actual";
