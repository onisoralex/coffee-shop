# Manual — Barista Screen (`/barista`)

The barista screen is a shared screen for two roles that work side by side: the **prep person** (operates the espresso machine and grinder) and the **barista** (adds milk, finishes drinks). One screen, two panels — each person naturally owns one panel.

This screen handles **coffee items only**. Non-coffee items (teas, cold drinks, food) are managed on the Counter screen.

---

## Layout

Two panels that rearrange based on device orientation:
- **Landscape:** PENDING panel on the left, IN_PROGRESS panel on the right.
- **Portrait:** PENDING panel on top, IN_PROGRESS panel below.

---

## PENDING panel (left / top)

Shows all coffee orders in **Pending** state — submitted but not yet started. Cards are ordered by time received (oldest first).

### Order cards

Each card shows:
- Order number and table
- List of coffee items with quantities and per-item notes (milk type, temperature, etc.)
- Time elapsed since the order was placed
- Urgency border:
  - **Amber** border: order has been waiting more than 5 minutes
  - **Red** border: order has been waiting more than 10 minutes
  - Borders are rechecked every 60 seconds

### Starting an order

**Tapping a PENDING card** emits a start signal. The card moves to the IN_PROGRESS panel immediately — no confirmation, no delay. The change is visible to anyone watching this screen.

---

## IN_PROGRESS panel (right / bottom)

Shows all coffee orders currently **In Progress** — started by the prep person, being finished by the barista.

### Order cards

Same information as PENDING cards. The barista uses these to see what milk requirements are coming (by also glancing at the PENDING panel for upcoming orders).

Urgency borders apply here too, using the same time thresholds (still counting from when the order was originally placed, not from when it was started).

### Completing an order

**Tapping an IN_PROGRESS card** marks it as done. The card disappears from this panel. Simultaneously:
- The order number appears as a **"42 C"** badge on the Pickup display (`/pickup`)
- The same badge appears in the Counter screen's right panel
- The Open tab on the Ordering screen updates the coffee part status to **Done**

---

## Sound notification

A sound plays when a new order arrives in the PENDING panel. The sound toggle is currently not exposed in the UI but the underlying logic is in place.

---

## Reconnection behavior

If the connection to the server drops and recovers:
- A **"Reconnected"** toast appears briefly at the bottom of the screen.
- All current orders are re-fetched automatically. No manual refresh is needed.

---

## Expected tester behaviors

| Scenario | Expected result |
|----------|----------------|
| Order placed from ordering screen | New card appears in PENDING panel immediately |
| Tap a PENDING card | Card moves to IN_PROGRESS panel; no card remains in PENDING for that order |
| Tap an IN_PROGRESS card | Card disappears; "42 C" badge appears on `/pickup` and `/counter` right panel; Open tab on `/order` shows Done |
| Order with only other items placed | Does not appear on this screen at all |
| Order waiting >5 minutes | Amber border on the card |
| Order waiting >10 minutes | Red border on the card |
| Order cancelled | Card disappears from whichever panel it is in |
| Server restarts or connection drops | Reconnected toast shown; cards reload to current state |
