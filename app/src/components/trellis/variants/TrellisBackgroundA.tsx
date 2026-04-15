import { useState } from 'react';

// Static image import via Vite's `new URL()` pattern for runtime resolution.
// Per CONTEXT D-31: this is a STATIC asset ONLY — no runtime generation via Nano Banana/Gemini.
// Asset may ship as .png or .webp — we try to resolve whichever exists.
// Using a glob import pattern lets Vite include only files that actually exist on disk.
const assetModules = import.meta.glob<string>(
  '../../../assets/planner-trellis/trellis-bg-default.{png,webp}',
  { eager: true, import: 'default', query: '?url' },
);

// Pick first resolved asset URL (png or webp, whichever exists)
const ASSET_URL = Object.values(assetModules)[0] ?? null;

export function TrellisBackgroundA() {
  const [loadFailed, setLoadFailed] = useState(false);

  if (!ASSET_URL || loadFailed) {
    // Fallback gradient — matches Ghibli warm palette. No asset dependency.
    return (
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          background:
            'linear-gradient(180deg, var(--node-peach) 0%, var(--surface) 60%, var(--surface-variant) 100%)',
        }}
      />
    );
  }

  return (
    <img
      src={ASSET_URL}
      alt=""
      aria-hidden="true"
      onError={() => setLoadFailed(true)}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
      }}
    />
  );
}
