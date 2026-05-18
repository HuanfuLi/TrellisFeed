import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark, Folder, FolderPlus, Check } from 'lucide-react';
import { BottomSheet } from './ui/BottomSheet';
import { engagementService } from '../services/engagement.service';
import { collectionService } from '../services/collection.service';
import { toast } from '../lib/toast';

// Phase 50 Plan 50-06 — UI-SPEC Surface 4 ("Save to..." picker sheet).
//
// YouTube-faithful save sheet (D-04). Triggered by the Save row tap in
// LongPressMenu (Phase 43); hosted at the screen level that owns the
// LongPressMenu state (HomeScreen, PostDetailScreen, CollectionDrillIn).
//
// Behavioral contract — D-05 single-tap-save preserved:
//   - On open: snapshot engagementService.isSaved(postId) into draft state,
//     pre-check the implicit Saved row, snapshot getPostCollections(postId)
//     into the draft membership Set.
//   - Toggling rows mutates ONLY the draft state — never the underlying
//     services. This is the T-50-PICKER-RACE mitigation: concurrent tap-tap
//     on different rows cannot interleave addPost / removePost writes.
//   - Done (or tap-outside, which is identical) computes the diff between
//     draft state and the captured-on-open baseline, then fires the minimal
//     set of mutations. If user did nothing → Saved is committed (single-tap
//     save preserved). Toast composes the user-visible summary.
//
// Threat mitigations:
//   - T-50-XSS-NAME: collection names render as React text node children,
//     never via the React HTML-injection escape hatch. The render boundary
//     is React's default escaping.
//   - T-50-PICKER-RACE: all writes are batched at handleDone time; no
//     per-tap writes.

interface CollectionPickerSheetProps {
  open: boolean;
  onClose: () => void;
  postId: string | null;
}

// Row style — copied from LongPressMenu.tsx:87-103 so the picker sheet looks
// like a sibling of the long-press menu (same touch-target, same gap).
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

const dividerStyle: CSSProperties = {
  height: 1,
  background: 'var(--border)',
  margin: '8px 0',
  border: 'none',
};

interface CheckboxProps {
  checked: boolean;
}

function Checkbox({ checked }: CheckboxProps) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: 4,
        border: checked ? '2px solid var(--primary-40)' : '2px solid var(--border)',
        background: checked ? 'var(--primary-40)' : 'transparent',
        flexShrink: 0,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {checked && <Check size={14} color="#fff" />}
    </span>
  );
}

export function CollectionPickerSheet({ open, onClose, postId }: CollectionPickerSheetProps) {
  const { t } = useTranslation();

  // All hooks declared above the defensive postId guard — Rules of Hooks
  // require the hook order to be stable across renders. The guard short-
  // circuits the RETURN, not the hook call sequence.
  //
  // Capture baseline on the first render of an open cycle. The host
  // re-mounts the sheet by toggling `open` + setting `postId`, so the
  // useMemo initializer re-runs whenever `postId` changes (i.e., a new open).
  // When `postId` is null the baseline collapses to `false` / empty set.
  const originalSaved = useMemo(
    () => (postId ? engagementService.isSaved(postId) : false),
    [postId],
  );
  const originalMemberIds = useMemo(
    () =>
      postId
        ? new Set(collectionService.getPostCollections(postId).map(c => c.id))
        : new Set<string>(),
    [postId],
  );

  // Read collections list once per open (no live subscription — sheet is a
  // short-lived sibling of LongPressMenu).
  const collections = useMemo(() => collectionService.getCollections(), [postId, open]);

  // Draft state — what the user has toggled but NOT yet committed.
  const [draftSavedChecked, setDraftSavedChecked] = useState<boolean>(originalSaved);
  const [draftMemberIds, setDraftMemberIds] = useState<Set<string>>(originalMemberIds);

  // Inline + New collection state.
  const [createMode, setCreateMode] = useState(false);
  const [createValue, setCreateValue] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Re-sync draft state whenever the keyed baseline (postId) changes — the
  // host pattern (HomeScreen) toggles `open` + `postId` simultaneously, but
  // if the same instance is reused across opens the useState lazy
  // initializers don't re-fire. Without this effect the second open would
  // show stale draft state from the previous post.
  useEffect(() => {
    setDraftSavedChecked(originalSaved);
    setDraftMemberIds(originalMemberIds);
    setCreateMode(false);
    setCreateValue('');
    setCreateError(null);
  }, [postId, originalSaved, originalMemberIds]);

  // Defensive guard — host may toggle open=true before postId is set, or
  // the post may have been purged. Render a closed sheet shell so the
  // BottomSheet portal still mounts cleanly (mirrors LongPressMenu.tsx:48-54).
  // Declared AFTER all hooks per Rules of Hooks.
  if (!postId) {
    return (
      <BottomSheet open={false} onClose={onClose} compact>
        <></>
      </BottomSheet>
    );
  }

  const toggleSaved = () => setDraftSavedChecked(prev => !prev);

  const toggleCollection = (collectionId: string) => {
    setDraftMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(collectionId)) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
  };

  const handleCreate = () => {
    const trimmed = createValue.trim();
    const result = collectionService.createCollection(trimmed);
    if (!result.success) {
      setCreateError(result.error);
      return;
    }
    // Success path — pre-check the new collection in the draft, clear input,
    // stay in createMode for chaining (user can create multiple in sequence).
    setDraftMemberIds(prev => {
      const next = new Set(prev);
      next.add(result.data.id);
      return next;
    });
    setCreateValue('');
    setCreateError(null);
  };

  const handleCreateKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setCreateMode(false);
      setCreateValue('');
      setCreateError(null);
    }
  };

  const handleDone = () => {
    // Compute and apply the saved-bucket diff first.
    if (draftSavedChecked !== originalSaved) {
      if (draftSavedChecked) engagementService.savePost(postId);
      else engagementService.removeSavedPost(postId);
    }

    // Compute and apply the collection-bucket diff. Iterate over the union
    // of original ∪ draft so additions AND removals are both visited.
    let addedCount = 0;
    let removedCount = 0;
    let lastAddedName: string | null = null;
    let lastRemovedName: string | null = null;

    const union = new Set<string>([...originalMemberIds, ...draftMemberIds]);
    for (const collectionId of union) {
      const wasMember = originalMemberIds.has(collectionId);
      const isMember = draftMemberIds.has(collectionId);
      if (isMember && !wasMember) {
        collectionService.addPost(collectionId, postId);
        addedCount += 1;
        lastAddedName = collections.find(c => c.id === collectionId)?.name ?? lastAddedName;
      } else if (!isMember && wasMember) {
        collectionService.removePost(collectionId, postId);
        removedCount += 1;
        lastRemovedName = collections.find(c => c.id === collectionId)?.name ?? lastRemovedName;
      }
    }

    // Compose toast summary — UI-SPEC §"Toast table".
    if (addedCount > 0) {
      if (addedCount === 1 && lastAddedName) {
        toast(t('library.collections.toast.added', { collection: lastAddedName }), 'success');
      } else {
        toast(t('library.collections.toast.addedMultiple', { count: addedCount }), 'success');
      }
    } else if (removedCount > 0 && lastRemovedName) {
      toast(t('library.collections.toast.removed', { collection: lastRemovedName }), 'info');
    } else if (draftSavedChecked && !originalSaved) {
      toast(t('engagement.toast.saved'), 'success');
    } else if (!draftSavedChecked && originalSaved) {
      toast(t('engagement.toast.unsaved'), 'info');
    }
    // else: no changes — silent close (matches D-05 single-tap-save with no
    // toggles flipped beyond the pre-check; the explicit save case above
    // covers the first-save-of-a-post path).

    // Reset inline-create state so the next open starts fresh.
    setCreateMode(false);
    setCreateValue('');
    setCreateError(null);

    onClose();
  };

  return (
    <BottomSheet open={open} onClose={handleDone} compact>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Title row */}
        <h3
          style={{
            margin: 0,
            marginBottom: 16,
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--foreground)',
          }}
        >
          {t('library.savePicker.title')}
        </h3>

        {/* Implicit Saved row — pinned at top, pre-checked from engagementService.isSaved */}
        <button type="button" style={rowStyle} onClick={toggleSaved}>
          <Checkbox checked={draftSavedChecked} />
          <Bookmark
            size={20}
            color={draftSavedChecked ? 'var(--primary-40)' : 'var(--foreground)'}
            fill={draftSavedChecked ? 'currentColor' : 'none'}
          />
          <span style={{ flex: 1 }}>{t('library.savePicker.implicitSaved')}</span>
        </button>

        <hr style={dividerStyle} />

        {/* Custom collection rows */}
        {collections.map(collection => {
          const isChecked = draftMemberIds.has(collection.id);
          return (
            <button
              key={collection.id}
              type="button"
              style={rowStyle}
              onClick={() => toggleCollection(collection.id)}
            >
              <Checkbox checked={isChecked} />
              <Folder size={20} color="var(--foreground)" />
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {collection.name}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--muted-foreground)',
                  flexShrink: 0,
                }}
              >
                {t('library.collections.postCount', { count: collection.postIds.length })}
              </span>
            </button>
          );
        })}

        {collections.length > 0 && <hr style={dividerStyle} />}

        {/* + New collection row — morphs to inline TextInput on tap */}
        {!createMode ? (
          <button
            type="button"
            style={rowStyle}
            onClick={() => {
              setCreateMode(true);
              setCreateError(null);
            }}
          >
            <FolderPlus size={20} color="var(--primary-40)" />
            <span style={{ flex: 1, color: 'var(--primary-40)', fontWeight: 600 }}>
              {t('library.savePicker.createNew')}
            </span>
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56 }}>
              <FolderPlus size={20} color="var(--primary-40)" />
              <input
                type="text"
                autoFocus
                value={createValue}
                onChange={e => {
                  setCreateValue(e.target.value);
                  if (createError) setCreateError(null);
                }}
                onKeyDown={handleCreateKeyDown}
                placeholder={t('library.savePicker.createPlaceholder')}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 44,
                  background: 'var(--surface-variant)',
                  border: '1.5px solid transparent',
                  borderRadius: 'var(--radius)',
                  padding: '0 12px',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handleCreate}
                style={{
                  height: 44,
                  padding: '0 16px',
                  background: 'var(--primary-40)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {t('library.collections.saveName')}
              </button>
            </div>
            {createError && (
              <p
                role="alert"
                style={{
                  margin: 0,
                  marginLeft: 32,
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--danger)',
                }}
              >
                {t(`library.savePicker.${createError}` as 'library.savePicker.nameEmpty')}
              </p>
            )}
          </div>
        )}

        {/* Done button — full-width, var(--primary-40) */}
        <button
          type="button"
          onClick={handleDone}
          style={{
            marginTop: 16,
            height: 48,
            width: '100%',
            background: 'var(--primary-40)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius)',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {t('library.savePicker.done')}
        </button>
      </div>
    </BottomSheet>
  );
}

export default CollectionPickerSheet;
