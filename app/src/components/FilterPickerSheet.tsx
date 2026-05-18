import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { BottomSheet } from './ui/BottomSheet';

// Phase 50 Plan 50-06 — UI-SPEC Surface 2 (Concept / Source / Date pickers).
//
// Shared single-select picker sheet — one component, three data sources.
// Reused by the Concept, Source, and Date filter chips in SavedScreen
// (plan 50-09 hosts these as inline filter chips).
//
// Behavioral contract:
//   - Row tap commits the filter via onSelect(value) AND dismisses via
//     onClose() in the SAME handler. No Done button — single-tap-commits.
//   - Tap-outside (BottomSheet built-in dismiss) is a no-op for the filter
//     state — the caller did not select a new value, so no commit fires.
//   - Active row is indicated by a leading Check icon at var(--primary-40);
//     inactive rows render the icon in `transparent` so layout stays stable.
//   - Empty-state branch fires when `options.length === 0` AND `emptyTitle`
//     is provided (Concept picker has both title + body; Source picker has
//     title only). Date picker passes a fixed 4-row list so this branch
//     never fires for it.
//   - Pure UI — data is provided by the caller. No service / provider imports.

export interface FilterPickerOption {
  label: string;
  value: string;
}

interface FilterPickerSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  options: FilterPickerOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  emptyTitle?: string;
  emptyBody?: string;
}

// Row style — mirrors LongPressMenu.tsx:87-103 + CollectionPickerSheet so all
// three sheets share the same touch-target shape.
const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  minHeight: '56px',
  padding: '0 16px',
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius)',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--foreground)',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

export function FilterPickerSheet({
  open,
  onClose,
  title,
  options,
  selected,
  onSelect,
  emptyTitle,
  emptyBody,
}: FilterPickerSheetProps) {
  const isEmpty = options.length === 0 && Boolean(emptyTitle);

  return (
    <BottomSheet open={open} onClose={onClose} compact>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Title row at 18/700 — same shape as CollectionPickerSheet */}
        <h3
          style={{
            margin: 0,
            marginBottom: 16,
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--foreground)',
          }}
        >
          {title}
        </h3>

        {isEmpty ? (
          // Empty-state branch (Concept / Source pickers when no anchors /
          // no contextLabel values exist). NO CTA per UI-SPEC §"Surface 2".
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '32px 16px',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--muted-foreground)',
              }}
            >
              {emptyTitle}
            </p>
            {emptyBody && (
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--muted-foreground)',
                  lineHeight: 1.4,
                }}
              >
                {emptyBody}
              </p>
            )}
          </div>
        ) : (
          options.map(option => {
            const isSelected = selected === option.value;
            return (
              <button
                key={option.value}
                type="button"
                style={rowStyle}
                onClick={() => {
                  onSelect(option.value);
                  onClose();
                }}
              >
                <Check
                  size={18}
                  color={isSelected ? 'var(--primary-40)' : 'transparent'}
                />
                <span style={{ flex: 1 }}>{option.label}</span>
              </button>
            );
          })
        )}
      </div>
    </BottomSheet>
  );
}

export default FilterPickerSheet;
