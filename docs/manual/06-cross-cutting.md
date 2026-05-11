# Manual — Cross-Cutting Behaviors

This page covers behaviors that apply to the whole system or span multiple screens.

---

## Language

The interface language is set by the administrator in **Management → Settings → Language**. Supported languages: English, Deutsch, Română.

- Applies to all screens and all connected devices simultaneously. A customer on the Ordering screen sees the same language as the barista screen.
- Takes effect immediately without any page refresh.
- Item descriptions and compositions can have per-language translations managed in the item edit dialog (Management → Menu tab → edit item → Translations section). The English text is always the fallback — if no translation exists for the active language, the English value is shown.
- Badge letters on the pickup display ("C" / "O") are not translated — they are consistent identifiers regardless of language setting.

---

## Dark mode

Toggled in **Management → Settings → Appearance → Dark mode**.

- Applies globally to all screens and all connected devices.
- Takes effect immediately.
- The theme is stored in the database and in browser local storage. Local storage is loaded first (so there is no light-flash before the DB value is read), then the DB value is applied as the authoritative setting.

---

## Real-time connection

All operational screens (Ordering, Barista, Counter, Pickup display) maintain a persistent connection to the server for live updates. You should never need to refresh any of these screens during normal operation.

If the connection is lost:
- The Barista and Counter screens show a **"Reconnected"** toast when the connection recovers, and automatically re-fetch all current orders.
- Other screens reconnect silently; their state is restored from the server on reconnect.
- There is currently no visible indicator while the connection is *down* (before it recovers). A future improvement is planned for this.

---

## Order number sequence

- Numbers run from 1 to 999 and reset at midnight each calendar day.
- The sequence is global — all staff share the same counter. Placing order 42 from the kiosk advances the counter for everyone.
- The counter can be jumped forward by manually entering a number in the order number field on the Ordering screen (bar only) and submitting. This is used when a new paper ticket block begins mid-shift (e.g., the block starts at 200).
- If two staff members both preview the next number at the same time, they will see the same value. The counter only advances when an order is actually submitted. This can result in two orders with the same number if submitted simultaneously; this is a known edge case and considered acceptable — the number is display-only and does not affect data integrity.
- After midnight, the first submitted order of the new day starts at 1 regardless of what the previous day ended on.

---

## Menu changes propagate in real time

When an administrator changes any menu item or category (availability, pause state, name, description, image, etc.), the Ordering screen on all connected devices updates immediately — no refresh required. This is particularly relevant when:

- Marking an item as unavailable during a shortage: it disappears from customer screens instantly.
- Pausing a category: all items in that category disappear immediately.
- Resuming or re-enabling: the item or category reappears without any action by customers or staff.

---

## Part-based order model

Each order tracks coffee items and non-coffee items as two independent parts. Understanding this model is essential for testing:

- An order with only coffee items has no "other" part. It only appears on the Barista screen and produces a "C" badge on the pickup display.
- An order with only other items has no "coffee" part. It only appears on the Counter screen and produces an "O" badge.
- An order with both types produces two independent badges that can be collected at different times.
- Cancelling an order sets all parts to Cancelled simultaneously and removes all badges.

---

## Orientation-aware layout

All two-panel screens (Ordering, Barista, Counter) respond to device **orientation**, not screen width.

- **Portrait:** panels stack vertically (top/bottom).
- **Landscape:** panels sit side by side (left/right).

Rotating a tablet mid-session immediately reflows the layout. This is intentional — staff at the bar may hold their tablets in different orientations depending on where they are standing.

---

## Touch behavior

Double-tap zoom is disabled globally. This prevents accidental zoom when staff tap menu cards or order cards quickly. Pinch-to-zoom remains available.
