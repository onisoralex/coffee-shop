# Manual — System Overview

This manual describes the coffee shop ordering system from the perspective of the people who use it: customers, staff, baristas, counter personnel, and administrators. It is written for anyone testing or operating the system.

---

## Roles and screens

| Role | Screen | URL |
|------|--------|-----|
| Customer (QR scan) | Ordering — table-locked mode | `/order?table={token}` |
| Staff / kiosk | Ordering — full mode | `/order` |
| Barista / prep person | Barista | `/barista` |
| Counter staff | Counter | `/counter` |
| Customer waiting | Pickup display | `/pickup` |
| Administrator | Management | `/management` |

The application runs on a local network. Every screen is always visible at `http://{server-ip}:3001/{route}` — there is no homepage or landing page that routes between them.

---

## The order lifecycle

An order passes through a series of states independently for its coffee items and its other (non-coffee) items. These two parts are tracked separately — a coffee can be ready for pickup while the food is still being prepared.

```
Order placed
    │
    ├── Coffee part ──► PENDING ──► IN_PROGRESS ──► DONE ──► PICKED_UP
    │                  (barista    (barista         (pickup    (collected)
    │                   screen)     screen)          display)
    │
    └── Other part ───► PENDING ──► IN_PROGRESS ──► DONE ──► PICKED_UP
                       (counter    (counter          (pickup    (collected)
                        screen)     screen)          display)
```

- An order that contains only coffee items has no "other" part, and vice versa.
- CANCELLED can be reached from any state and sets all parts of the order simultaneously.
- PICKED_UP removes a part from the pickup display. If only the coffee part is collected, the other badge stays visible until that part is also collected.

---

## What updates in real time

Every operational screen — ordering, barista, counter, and pickup — receives live updates over a persistent connection. No screen should ever need a manual refresh during normal operation.

| Action | Who sees it immediately |
|--------|------------------------|
| Order placed | Barista screen, Counter screen, Open tab in Ordering |
| Barista starts coffee part | Barista screen (card moves panels) |
| Barista marks coffee done | Barista screen, Counter screen, Pickup display, Open tab |
| Counter starts/finishes other part | Counter screen |
| Counter marks part picked up | Counter screen, Pickup display, Open tab |
| Staff marks Delivered in Open tab | Counter screen, Pickup display |
| Menu item toggled unavailable | Ordering screen (category/item disappears) |
| Category paused | Ordering screen (category disappears) |
| Menu item added or edited | Ordering screen (updated immediately) |

If the connection drops and reconnects, the Barista and Counter screens automatically re-fetch all current orders and show a brief "Reconnected" toast. Other screens reconnect silently.

---

## Order numbers

Orders are assigned a human-readable number (1–999) that resets each calendar day. This number is what staff call out and what appears on the pickup display.

- The number is shared across all staff — placing order 42 from the kiosk means the next order from any device will be 43.
- The counter can be reset or jumped manually from the order number field on the ordering screen (bar only). See [Ordering screen](01-ordering.md) for details.
- Order numbers are display-only. The system uses internal IDs for all data operations; duplicate numbers are not a data integrity problem, only a verbal communication problem.

---

## Language and appearance

The interface language (English, German, Romanian) and visual theme (light/dark) are set by the administrator in the Management screen and apply globally to all screens and all devices. See [Management screen](05-management.md) and [Cross-cutting behaviors](06-cross-cutting.md) for details.
