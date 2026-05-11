# Manual — Pickup Display (`/pickup`)

The pickup display is a read-only big screen intended to be visible to customers waiting for their orders. It shows which order numbers are ready for collection.

There is no interaction on this screen. All dismissals are done from the Counter screen (`/counter`) or from the Open tab on the Ordering screen (`/order`).

---

## What is shown

Each ready order part appears as a large badge:

- **"42 C"** — the coffee part of order 42 is ready
- **"42 O"** — the other (non-coffee) part of order 42 is ready

Badges are sorted by order number in ascending order. New badges animate in with a fade and scale effect.

The display is designed to be readable from approximately 3 meters away.

---

## When badges appear and disappear

| Event | Effect on pickup display |
|-------|--------------------------|
| Barista taps an In Progress coffee card | "42 C" badge appears |
| Counter staff taps an In Progress other card | "42 O" badge appears |
| Counter staff taps a badge on the Counter screen | Corresponding badge disappears |
| Server taps Delivered in the Open tab (Ordering screen) | Corresponding badge disappears |
| Order is cancelled | All badges for that order disappear |

Coffee and other badges for the same order are independent — one can disappear before the other.

---

## Relationship to the Counter screen

The right panel of the Counter screen (`/counter`) shows the same set of badges as this screen, always in sync. The counter person uses their panel to dismiss badges; the Pickup display reflects those dismissals instantly.

---

## Expected tester behaviors

| Scenario | Expected result |
|----------|----------------|
| Barista marks coffee done | "42 C" badge appears with fade-in animation |
| Counter marks other done | "42 O" badge appears with fade-in animation |
| Counter taps the "C" badge on Counter screen | "42 C" badge disappears from Pickup display |
| Counter taps the "O" badge on Counter screen | "42 O" badge disappears; "42 C" is unaffected if still present |
| Staff taps Delivered on the Open tab | Corresponding badge disappears |
| Order cancelled | All badges for that order number disappear |
| Multiple orders ready | Badges sorted by order number; lowest number shown first |
| New badge arrives while display is showing others | Animates in; existing badges are not disturbed |
