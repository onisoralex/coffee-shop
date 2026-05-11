# Manual — Ordering Screen (`/order`)

The ordering screen is used in two distinct modes depending on how it is accessed.

---

## Modes

### Kiosk / staff mode — `/order`

Used by staff at the bar or at a kiosk. All tables are selectable, and the full ordering UI is shown. This is the primary entry point for staff placing orders on behalf of customers.

### QR / customer mode — `/order?table={token}`

Accessed by customers who scan a QR code at their table. The table is automatically resolved from the token in the URL. The customer cannot see or change the table; they can only see orders belonging to their own table.

The token is a unique identifier generated per table. It can be rotated from the Management screen, at which point the old QR link stops working.

---

## Layout

The screen has two panels that rearrange based on device orientation:
- **Landscape:** menu panel on the left, cart panel on the right.
- **Portrait:** menu panel on top, cart panel below.

This responds to device rotation, not screen width — rotating a tablet mid-session immediately reflows the layout.

---

## Menu panel

### Category tabs

The menu is grouped into categories. Categories appear as horizontal tabs above the item grid. Tapping a tab filters the grid to that category.

- Only available categories are shown. Categories marked as paused by the administrator are hidden entirely.
- Tabs scroll horizontally if there are more than fit on screen.

### Item cards

Each card shows:
- Item name
- Description (if enabled by admin)
- Composition (if enabled by admin)
- Image (if enabled by admin and item has an image)
- Quantity badge (shown when the item is in the cart — displays total across all cart lines for that item)
- Blue border highlight when the item is in the cart

**Tapping a card:**
- If the item has no cart lines yet: creates a new cart line with quantity 1.
- If the item already has a cart line with no notes: increments that line's quantity by 1.
- If the item's only existing lines all have notes: creates a new empty-notes line with quantity 1. This allows ordering, for example, two flat whites with oat milk and one flat white with regular milk as separate lines.

Items marked unavailable by the administrator do not appear in the menu.

---

## Cart panel

The cart panel has two tabs: **Order** and **Open**.

### Table selector

Above the tabs (in kiosk/staff mode only), a dropdown allows selecting the table this order belongs to. The Bar table is selected by default.

In QR mode, the table selector is hidden. The table is fixed to the one resolved from the URL token.

---

## Order tab

### Order number field

Shown **only when the Bar table is selected**. Hidden for all other tables (table orders are delivered by a server and do not need a spoken number).

- Pre-filled automatically with the next number in today's sequence (e.g., if the last order was 41, the field shows 42). This is a preview — reading the next number does not increment the counter.
- Two staff members previewing at the same time will see the same number. This is expected behavior; the number is for verbal communication and the system resolves conflicts by taking the value at submit time.
- **Manual override:** The field is editable. Typing a new number and submitting syncs the daily counter to that value, so the next auto-fill will be that number + 1. This is used when starting a new paper ticket block (e.g., setting it to 200 so subsequent orders continue 201, 202, ...).
- After a successful submit, the field re-fetches the next number from the server instead of clearing to blank. The previous value stays visible until the new one loads, avoiding a blank-field flash during rapid order entry.

### Cart lines

Each item in the cart appears as one or more lines. The same menu item can appear on multiple lines if it has different notes.

Each cart line shows:
- Item name (tap to expand/collapse the notes field)
- Quantity controls (− and + buttons)
- Notes field (hidden by default; tap the item name to reveal; auto-collapses when you leave focus if the field is empty)

**Notes behavior:** Notes are free-text modifiers (milk type, temperature, extras, etc.). A line's notes are locked once filled in — tapping the menu card again will not increment a line that already has notes. It creates a new empty-notes line instead. This is intentional: it preserves the separation between e.g. "oat milk" and "regular milk" variants of the same item.

**Removing items:** Use the − button to reduce quantity. Reaching 0 removes the line.

### Submitting an order

The Submit button places the order. On success:
- The cart clears immediately — staff can begin the next order without waiting.
- No confirmation or status screen appears.
- The Open tab receives the new order in real time.

If submission fails (e.g., network error), an error message is shown. The cart is not cleared.

---

## Open tab

Shows all active orders for the currently selected table — orders that have at least one part not yet in PICKED_UP or CANCELLED state.

Updates in real time: new orders appear as soon as they are placed, and status changes from the barista or counter screens are reflected immediately.

### Order cards

Each card shows:
- Order number
- List of items with quantities and notes
- Status chips for the coffee part and other part (when present):
  - **Pending** — submitted, not yet started
  - **In Progress** — being prepared
  - **Done** — ready for pickup
  - **Picked Up** — collected
  - **Cancelled** — order was cancelled

### Delivered button

A **Delivered** button appears on a card when at least one part has reached **Done** status. Tapping it marks that part as picked up (`order:part:picked_up`), which removes the corresponding badge from the pickup display.

This is how servers mark table orders as delivered. The counter staff use their own screen to handle bar orders.

### QR / customer mode scope

In QR mode, the Open tab only shows orders belonging to the token's table. The customer cannot see orders from other tables.

---

## Expected tester behaviors

| Scenario | Expected result |
|----------|----------------|
| Tap a menu item with no existing cart line | New line created, quantity = 1, badge appears on card |
| Tap a menu item already in cart (no notes) | Quantity on that line increments by 1 |
| Tap a menu item whose only lines all have notes | New separate line created (quantity = 1, no notes) |
| Fill in notes on a cart line, then tap the menu card again | New empty-notes line added; existing line with notes unchanged |
| Tap item name on a cart line | Notes field expands |
| Leave notes empty and click away | Notes field collapses; no note saved |
| Override order number to 50, submit | Next auto-fill shows 51 |
| Submit order | Cart clears; order appears in Open tab; appears on barista/counter screen |
| Open `/order?table={token}` | Table picker hidden; table auto-selected; Open tab shows only that table's orders |
| Open `/order?table={invalid-token}` | Error state shown; ordering is not possible until resolved |
| Mark order Delivered when a part is Done | Badge disappears from pickup display and counter right panel |
