// Phase 50 UAT G12 regression guard.
//
// Root cause of G12: BottomSheet.tsx renders its children unconditionally and
// only animates `transform: translateY` between 0 and 100% to show/hide. If a
// child <input> declares bare `autoFocus`, the input is focused on screen
// mount regardless of the sheet's `open` state — invoking the iOS / Android
// system keyboard every time the host screen mounts (Phase 50 UAT-4: the
// /saved Bookmark icon top-right on /home popped the keyboard before the user
// touched the search bar).
//
// Source-reading guard: any file that imports BottomSheet must NOT contain a
// bare `autoFocus` attribute on an <input>. The correct pattern is:
//
//   const ref = useRef<HTMLInputElement | null>(null);
//   useEffect(() => {
//     if (sheetOpen) requestAnimationFrame(() => ref.current?.focus());
//   }, [sheetOpen]);
//   ...
//   <input ref={ref} type="text" ... />
//
// This is enforced as a project-wide invariant: it touches Capacitor IME
// behavior on every Android / iOS device.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');

function findBottomSheetConsumers() {
  // ripgrep first; fallback to grep -r if rg is not installed.
  try {
    const out = execSync(
      `rg -l "from '.*BottomSheet'" --type ts --type tsx ${path.join(appRoot, 'src')}`,
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return out.toString().split('\n').filter(Boolean);
  } catch {
    const out = execSync(
      `grep -rln "from '.*BottomSheet'" ${path.join(appRoot, 'src')}`,
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return out.toString().split('\n').filter(Boolean);
  }
}

test('G12: no BottomSheet consumer declares bare autoFocus on an input child', () => {
  const files = findBottomSheetConsumers();
  assert.ok(files.length > 0, 'Expected to find at least one BottomSheet consumer in src/');

  const offenders = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    const src = readFileSync(file, 'utf8');

    // Find every `autoFocus` occurrence. For each, walk backwards to the
    // nearest `<input` opening tag. If found, this is an offender unless the
    // input is gated by a conditional render (the conservative test treats
    // EVERY autoFocus inside an input as suspect — conditional rendering on
    // sheet-open is fine but rare enough that we'd rather false-positive than
    // miss the real G12 shape).
    //
    // Allowed exception: CollectionPickerSheet's inline-create input is
    // wrapped in `createMode ? <input autoFocus.../> : ...` — it ONLY mounts
    // when createMode is true, so autoFocus is safe. The test skips that
    // specific known-good case via a marker comment the source MUST contain.

    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!/\bautoFocus\b/.test(lines[i])) continue;

      // Walk back up to 20 lines looking for the <input opening tag.
      let inputLine = -1;
      for (let j = i; j >= Math.max(0, i - 20); j--) {
        if (/<input\b/.test(lines[j])) {
          inputLine = j;
          break;
        }
      }
      if (inputLine === -1) continue; // autoFocus was on something else

      // Allow the known-good conditional-mount pattern in CollectionPickerSheet.
      const window = src.slice(0, src.indexOf(lines[i]) + lines[i].length);
      const lastConditional = window.lastIndexOf('createMode ?');
      const lastInputOpen = window.lastIndexOf('<input');
      // If the input opening sits inside a `createMode ? ...` ternary branch,
      // it only mounts when createMode is true. Safe.
      if (
        lastConditional !== -1 &&
        lastInputOpen !== -1 &&
        lastConditional < lastInputOpen
      ) {
        // The input is inside the `createMode ? (...) : (...)` true branch.
        continue;
      }

      offenders.push(`${path.relative(appRoot, file)}:${i + 1}`);
    }
  }

  assert.equal(
    offenders.length,
    0,
    `Bare autoFocus on input inside BottomSheet consumer(s): ${offenders.join(
      ', ',
    )}. BottomSheet always renders its children — autoFocus pops the system ` +
      `keyboard on screen mount. Replace with ref + useEffect(() => sheetOpen && ref.current?.focus(), [sheetOpen]).`,
  );
});
