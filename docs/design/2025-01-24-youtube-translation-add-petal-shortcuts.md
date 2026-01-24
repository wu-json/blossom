# YouTube Translation Add Petal Shortcuts

**Date:** 2025-01-24
**Status:** Draft

## Overview

Add keyboard shortcuts to quickly save vocabulary (petals) from the translation breakdown in YouTube translation mode. When a translation is displayed, users can press number keys to save the corresponding word from the breakdown list without clicking:

- **1-9** for items 1-9
- **Shift+1-9** for items 10-18 (Shift+1 = 10, Shift+2 = 11, etc.)
- **Shift+0** for item 19 (if needed)

## Problem

Currently, saving a word from the translation breakdown requires:

1. Moving the mouse to hover over the word row
2. Clicking the save button that appears on hover

For users rapidly translating multiple frames, this interrupts the keyboard-driven workflow established by other shortcuts (⌘Enter to translate, Space to pause, arrow keys to seek). Users want to quickly save vocabulary without leaving the keyboard.

## Solution

Add number key shortcuts that correspond to breakdown items by position:

**Without Shift (items 1-9):**
- **1** saves the 1st word in the breakdown
- **2** saves the 2nd word
- ... and so on up to **9** for the 9th word

**With Shift (items 10-19):**
- **Shift+1** saves the 10th word
- **Shift+2** saves the 11th word
- ... and so on up to **Shift+9** for the 18th word
- **Shift+0** saves the 19th word (if present)

The shortcut keys are displayed as small `<kbd>` indicators in each word row, matching the existing shortcut style used for translate (⌘↵), region (r), and adjust region (e).

## User Flow

### Saving a Word via Shortcut

1. User translates a frame (⌘Enter or click "Translate Frame")
2. Translation appears with breakdown list showing numbered indicators
3. User presses a number key (e.g., **3**) to save the 3rd word
4. Word is saved as a petal with bloom animation feedback
5. The `<kbd>` indicator changes to show the word is saved (checkmark or filled state)

### Removing a Saved Word

1. User has previously saved a word from the breakdown
2. User presses the same number key again
3. Word is removed from petals with wilt animation feedback

## Technical Design

### Keyboard Handler Extension

Extend the existing `handleKeyDown` function in `youtube-viewer.tsx` (lines 498-560) to handle number keys:

```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  // Early exit: only listen when player is ready and not in input field
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return;
  }

  // ... existing shortcuts (Space, ⌘Enter, arrows, ], r, e, Escape) ...

  // NEW: Number keys for petal shortcuts
  // Only active when:
  // - A translation is visible (currentTranslation exists)
  // - Not currently streaming a translation
  // - No Cmd/Ctrl/Alt modifiers (Shift is allowed for 10-19)
  if (
    currentTranslation &&
    !isTranslating &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey
  ) {
    // Parse the key - handle both regular and Shift+number
    // Shift+1 produces "!" on US keyboards, but e.key with Shift shows the symbol
    // Use e.code instead: "Digit1", "Digit2", etc.
    const digitMatch = e.code.match(/^Digit(\d)$/);
    if (digitMatch) {
      const digit = parseInt(digitMatch[1], 10);
      let index: number;

      if (e.shiftKey) {
        // Shift+1-9 = items 10-18 (index 9-17)
        // Shift+0 = item 19 (index 18)
        index = digit === 0 ? 18 : digit + 8;
      } else {
        // 1-9 = items 1-9 (index 0-8)
        // 0 without shift = no action (could be used for something else)
        if (digit === 0) return;
        index = digit - 1;
      }

      const breakdown = currentTranslation.breakdown;
      if (index < breakdown.length) {
        e.preventDefault();
        const word = breakdown[index];

        if (savedWords.has(word.word)) {
          handleRemoveWord(word.word);
        } else {
          handleSaveWord(word);
        }
      }
    }
  }
};
```

**Note on Shift+Number:** On US keyboards, Shift+1 produces "!", Shift+2 produces "@", etc. Using `e.code` instead of `e.key` gives us the physical key ("Digit1") regardless of Shift state, making the logic cleaner and keyboard-layout independent.

### Keyboard Conflict Analysis

**Existing YouTube viewer shortcuts:**
| Key | Function | Conditions |
|-----|----------|------------|
| Space | Play/Pause | playerReady |
| ⌘/Ctrl+Enter | Translate frame | playerReady, not extracting/translating |
| ←/→ | Seek ±5s | playerReady |
| ] | Toggle collapse | playerReady |
| r | Toggle region | region exists, playerReady |
| e | Adjust region | playerReady, not extracting/translating/adjusting |
| Escape | Cancel region | isAdjustingRegion |

**Why number keys are safe:**
- 1-9 and Shift+0-9 are not used by any existing feature
- YouTube's native player shortcuts (0-9 for seek percentage) are overridden by our handler since we capture at window level
- Browser shortcuts using numbers typically require Ctrl/Cmd (e.g., Ctrl+1 for tab switching)
- Shift+number doesn't conflict with browser shortcuts (Shift+Ctrl+number would, but we exclude Ctrl)

**Conditions to avoid conflicts:**
- Only active when `currentTranslation` exists (translation is visible)
- Only active when `!isTranslating` (not during streaming)
- Only active when no Cmd/Ctrl/Alt modifiers are pressed (Shift is allowed for 10-19)
- Respects existing input field exclusion

### UI Display

Update the `WordRow` component in `src/components/translation-card.tsx` to display keyboard shortcut indicators:

```typescript
interface WordRowProps {
  word: WordBreakdown;
  language: string;
  isSaved: boolean;
  onSave: (word: WordBreakdown) => void;
  onRemove: (word: string) => void;
  index?: number;           // NEW: position in breakdown (0-indexed)
  showShortcut?: boolean;   // NEW: whether to show kbd indicator
}

// Helper to get the shortcut display for a given index
function getShortcutDisplay(index: number): { key: string; hasShift: boolean } | null {
  if (index < 0 || index > 18) return null; // Max 19 items (0-18)

  if (index < 9) {
    // Items 1-9: keys 1-9
    return { key: String(index + 1), hasShift: false };
  } else if (index < 18) {
    // Items 10-18: Shift + 1-9
    return { key: String(index - 8), hasShift: true };
  } else {
    // Item 19: Shift + 0
    return { key: "0", hasShift: true };
  }
}

function WordRow({
  word,
  language,
  isSaved,
  onSave,
  onRemove,
  index,
  showShortcut = false,
}: WordRowProps) {
  const shortcut = index !== undefined ? getShortcutDisplay(index) : null;

  return (
    <div className="group relative flex items-center gap-3 py-2 px-3 rounded-lg transition-all cursor-pointer hover:scale-[1.01]">
      {/* Shortcut indicator - shown on left side */}
      {showShortcut && shortcut && (
        <kbd
          className="flex-shrink-0 min-w-[20px] h-5 flex items-center justify-center rounded text-[10px] font-mono transition-all gap-0.5"
          style={{
            backgroundColor: isSaved ? "var(--primary)" : "var(--surface-elevated)",
            color: isSaved ? "white" : "var(--text-muted)",
            border: isSaved ? "none" : "1px solid var(--border)",
            // Wider for Shift+number indicators
            minWidth: shortcut.hasShift ? "32px" : "20px",
          }}
        >
          {isSaved ? "✓" : (
            <>
              {shortcut.hasShift && <span style={{ fontSize: "8px" }}>⇧</span>}
              {shortcut.key}
            </>
          )}
        </kbd>
      )}

      {/* Existing word display content */}
      <div
        className="w-1 h-full rounded-full flex-shrink-0"
        style={{ backgroundColor: partOfSpeechColors[word.partOfSpeech] || "#6B7280" }}
      />
      {/* ... rest of word, reading, meaning, part of speech ... */}
    </div>
  );
}
```

### Visual Design

The `<kbd>` shortcut indicator follows the existing pattern:

```
+------------------------------------------------------------------+
|  Translation Breakdown                                           |
+------------------------------------------------------------------+
|  [ 1 ] ● 食べる    たべる    to eat         verb                 |
|  [ 2 ] ● りんご              apple          noun                 |
|  [ 3 ] ● を                  (object)       particle             |
|  [ ✓ ] ● 毎日      まいにち  every day      adverb   <- saved    |
|  [ 5 ] ● 私        わたし    I/me           pronoun              |
|  [ 6 ] ● が                  (subject)      particle             |
|  [ 7 ] ● 好き      すき      like           adjective            |
|  [ 8 ] ● です                (copula)       auxiliary            |
|  [ 9 ] ● か                  (question)     particle             |
|  [⇧1 ] ● ね                  (emphasis)     particle  <- item 10 |
|  [⇧2 ] ● よ                  (assertion)    particle  <- item 11 |
+------------------------------------------------------------------+
```

**Indicator states:**
- **Default (1-9)**: Number on muted background with border (`var(--surface-elevated)`, `var(--border)`)
- **Default (10-19)**: Shift symbol (⇧) + number, slightly wider indicator
- **Saved**: Checkmark on primary background, white text (`var(--primary)`)
- **Hover**: Slight scale increase (inherit from existing WordRow hover)

### Props Threading

The shortcut indicator needs the index passed from parent. Update the rendering in `TranslationCard`:

```typescript
// In TranslationCard component
{data.breakdown.map((word, index) => (
  <WordRow
    key={`${word.word}-${index}`}
    word={word}
    language={language}
    isSaved={savedWords.has(word.word)}
    onSave={onSaveWord}
    onRemove={onRemoveWord}
    index={index}
    showShortcut={showShortcuts}  // prop from parent, true when in YouTube viewer
  />
))}
```

The `showShortcuts` prop should be `true` when rendering in YouTube translation mode and `false` when rendering in the chat view (where number key shortcuts don't apply).

### State Management

The existing `savedWords` Set and handlers (`handleSaveWord`, `handleRemoveWord`) in `youtube-viewer.tsx` are reused:

```typescript
// Already exists in youtube-viewer.tsx
const [savedWords, setSavedWords] = useState<Set<string>>(new Set());

const handleSaveWord = async (word: WordBreakdown) => {
  // POST to /api/petals
  // Update savedWords Set
  // Trigger bloom animation
};

const handleRemoveWord = async (wordText: string) => {
  // DELETE from /api/petals
  // Update savedWords Set
  // Trigger wilt animation
};
```

The keyboard handler simply calls these existing functions.

## UI Layout

### Translation Panel with Shortcuts

```
+--------------------------------------------+
|  Collapse  [🍃 Meadow ↗]              [ ] ] |
+--------------------------------------------+
|                                            |
|  私は毎日りんごを食べるのが好きですか        |
|  watashi wa mainichi ringo wo taberu...    |
|                                            |
|  ┌──────────────────────────────────────┐  |
|  │ Do I like eating apples every day?  │  |
|  └──────────────────────────────────────┘  |
|                                            |
|  Breakdown                                 |
|  ┌──────────────────────────────────────┐  |
|  │ [ 1 ] ● 私      わたし  I/me    pron │  |
|  │ [ 2 ] ● は             (topic)  part │  |
|  │ [ 3 ] ● 毎日    まいにち every.. adv │  |
|  │ [ 4 ] ● りんご         apple    noun │  |
|  │ [ ✓ ] ● を             (obj)    part │  |  <- saved
|  │ [ 6 ] ● 食べる  たべる to eat   verb │  |
|  │ [ 7 ] ● の             (nom)    part │  |
|  │ [ 8 ] ● が             (subj)   part │  |
|  │ [ 9 ] ● 好き    すき   like     adj  │  |
|  │ [⇧1 ] ● です           (copula) aux  │  |  <- item 10
|  │ [⇧2 ] ● か             (ques)   part │  |  <- item 11
|  └──────────────────────────────────────┘  |
|                                            |
|  Grammar Notes                             |
|  の nominalizes the verb phrase...         |
|                                            |
+--------------------------------------------+
```

### Shortcut Indicator Sizing

The `<kbd>` element should be compact and unobtrusive:

```css
/* Approximate styles */
kbd {
  min-width: 20px;      /* 32px for Shift+number indicators */
  height: 20px;
  font-size: 10px;
  font-family: monospace;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;             /* Space between ⇧ and number */
}

kbd .shift-symbol {
  font-size: 8px;       /* Slightly smaller shift symbol */
}
```

## Edge Cases

### More Than 19 Breakdown Items

- Items 1-9 use keys 1-9
- Items 10-18 use Shift+1-9
- Item 19 uses Shift+0
- Items 20+ can still be saved via click (existing behavior)
- Shortcut indicator is not rendered for items beyond index 18

```typescript
// Helper returns null for index >= 19
const shortcut = index !== undefined ? getShortcutDisplay(index) : null;

// In render:
{shortcut && (
  <kbd>...</kbd>
)}
```

Most translations have fewer than 10 breakdown items. Complex sentences with 19+ words are rare but supported via click.

### During Streaming

- Shortcuts are disabled while `isTranslating` is true
- The keyboard handler early-returns if streaming is in progress
- This prevents saving partial/incomplete breakdown items

### No Translation Visible

- Shortcuts only work when `currentTranslation` exists
- Pressing number keys does nothing when no translation is displayed
- No error or feedback needed (silent no-op)

### Timeline Translations

When viewing a translation from the timeline (not the current one):

- The shortcut indicators should still display
- The keyboard handler should reference the currently displayed translation (may need to track `displayedTranslationId`)
- Save/remove operations use the correct translation ID for the petal's context

```typescript
// May need to track which translation is being displayed
const [displayedTranslationId, setDisplayedTranslationId] = useState<string | null>(null);

// When clicking a timeline item:
setDisplayedTranslationId(timelineItem.id);

// In keyboard handler, use displayedTranslationId for the petal's messageId
```

### Duplicate Words in Breakdown

Some translations may have the same word appear multiple times (e.g., repeated particles):

- Each position has its own shortcut (pressing 2 always targets position 2)
- The `savedWords` Set uses the word text as key, so saving any instance marks all as saved
- This matches existing click behavior

## Implementation Steps

1. **Update WordRow component** (`src/components/translation-card.tsx`):
   - Add `index` and `showShortcut` props
   - Add `getShortcutDisplay()` helper function
   - Render `<kbd>` indicator when `showShortcut` is true and index < 19
   - Show ⇧ prefix for items 10-19
   - Style indicator based on saved state

2. **Update TranslationCard component** (`src/components/translation-card.tsx`):
   - Add `showShortcuts` prop
   - Pass `index` and `showShortcuts` to each WordRow

3. **Update StreamingTranslationCard** (`src/components/translation-card.tsx`):
   - Same changes as TranslationCard (pass index, showShortcuts)
   - Shortcuts disabled during streaming anyway

4. **Update YouTube viewer** (`src/features/youtube/youtube-viewer.tsx`):
   - Pass `showShortcuts={true}` to TranslationCard/StreamingTranslationCard
   - Extend `handleKeyDown` with number key handling
   - Ensure correct translation reference for timeline items

5. **Update chat TranslationCard usage** (if any in chat feature):
   - Pass `showShortcuts={false}` to maintain existing behavior

6. **i18n** (optional):
   - No new strings needed; shortcuts are universal numbers

7. **Testing**:
   - Test saving via 1-9 keys (items 1-9)
   - Test saving via Shift+1-9 keys (items 10-18)
   - Test saving via Shift+0 (item 19)
   - Test toggle behavior (press to save, press again to remove)
   - Test with >19 breakdown items (items 20+ should have no indicator)
   - Test during streaming (should be disabled)
   - Test with timeline items
   - Test no conflicts with existing shortcuts
   - Test on different keyboard layouts (using e.code for layout independence)

## Accessibility

- The `<kbd>` element provides semantic meaning for keyboard shortcuts
- Screen readers will announce the number as content
- The visual indicator provides clear affordance for the shortcut
- Saved state is indicated both visually (checkmark, color) and programmatically

## Future Enhancements

1. **Quick review mode**: Press Alt + number to preview word details before saving
2. **Custom key bindings**: Allow users to remap shortcut keys
3. **Shortcut legend**: Toggle a help overlay showing all available shortcuts (e.g., press "?" to show)
4. **Haptic/audio feedback**: Optional sound or vibration on save (mobile)
5. **Extended range**: Support items 20+ with additional modifier combinations if needed

## Design Decisions

1. **Number keys vs. letter keys**: Numbers provide a clear positional mapping (1st item = 1) and don't conflict with existing letter shortcuts (r, e). Letters would require memorization of which letter maps to which action.

2. **1-19 range with Shift**: Most translations have fewer than 10 breakdown items, but complex sentences can have more. Using Shift+number for items 10-19 doubles the range without requiring Ctrl/Cmd which would conflict with browser shortcuts.

3. **e.code vs e.key**: Using `e.code` ("Digit1") instead of `e.key` ("!" when Shift is held) provides keyboard-layout independence. This ensures shortcuts work correctly on non-US keyboards where Shift+number produces different characters.

4. **Toggle behavior**: Pressing a number key toggles the save state (save if not saved, remove if saved). This matches the click behavior and provides quick undo capability without needing a separate key.

5. **Indicator placement**: The `<kbd>` is placed at the start of each row (left side) for consistent visual scanning. Users can glance at the left edge to see which key to press.

6. **Shift indicator (⇧)**: The visual indicator shows ⇧ prefix for items 10-19, making it clear that Shift is required. The indicator is slightly wider to accommodate the symbol.

7. **showShortcut prop**: Rather than always showing shortcuts, a prop controls visibility. This allows the same component to work in chat (no shortcuts) and YouTube (with shortcuts) without conditional logic scattered throughout.
