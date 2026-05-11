# Manual — Counter Screen (`/counter`)

The counter screen is used by the person stationed at the counter. They have two responsibilities: preparing non-coffee items (teas, cold drinks, food), and managing the pickup display — physically handing orders to customers and dismissing their badges from the screen.

---

## Layout

Two panels that rearrange based on device orientation:
- **Landscape:** prep queue on the left, pickup display on the right.
- **Portrait:** prep queue on top, pickup display below.

---

## Prep queue panel (left / top)

Shows all orders that have **other** (non-coffee) items in Pending or In Progress state. Coffee items do not appear here — those are handled on the Barista screen.

### Order cards

Each card shows:
- Order number and table
- List of other items (teas, cold drinks, food) with quantities and per-item notes
- A status chip indicating the current state of the other part: **Pending** or **In Progress**
- Time elapsed since the order was placed
- Urgency border:
  - **Amber** border: order has been waiting more than 5 minutes
  - **Red** border: order has been waiting more than 10 minutes

### Advancing an order

**Tap a Pending card** → status changes to **In Progress** (the counter person has started preparing the items).

**Tap an In Progress card** → status changes to **Done**. The card leaves this panel. Simultaneously:
- A **"42 O"** badge appears on the Pickup display (`/pickup`)
- The same badge appears in this screen's right panel
- The Open tab on the Ordering screen shows the other part as Done

A single tap advances the state by one step. There is no undo — if tapped accidentally, the order moves forward.

---

## Pickup display panel (right / bottom)

Shows all order parts that are currently **Done** and waiting to be collected — both coffee parts ("42 C") and other parts ("42 O"). This panel is the interactive version of what customers see on the `/pickup` screen. Both always show the same set of orders.

### Badge format

- **"42 C"** — coffee part of order 42 is ready
- **"42 O"** — other part of order 42 is ready

Each badge shows the item list below the number so the counter person knows what is in the bag without looking up the order.

Coffee and other parts are shown as separate badges and can be dismissed independently. If an order has both coffee and other items, both badges appear and can be picked up at different times.

### Dismissing a badge

**Tap a badge** → that part is marked as picked up. The badge disappears from this panel, from the `/pickup` screen, and the Open tab on the Ordering screen updates accordingly.

If a customer collects only the coffee and not the food, only the "C" badge is dismissed. The "O" badge remains on both screens until it is also collected.

Orders can also be marked as delivered from the Open tab on the Ordering screen (by a server at the table). In that case, the badge disappears from both this panel and the pickup display automatically.

---

## Reconnection behavior

If the connection drops and recovers:
- A **"Reconnected"** toast appears briefly.
- All current orders and display state are re-fetched automatically. No manual refresh is needed.

---

## Expected tester behaviors

| Scenario | Expected result |
|----------|----------------|
| Order placed with other items | Card appears in prep queue (left panel) with Pending chip |
| Tap a Pending card | Chip changes to In Progress; card stays in panel |
| Tap an In Progress card | Card leaves prep queue; "42 O" badge appears in right panel and on `/pickup` |
| Order placed with only coffee items | Does not appear in prep queue at all |
| Order placed with both coffee and other items | Two badges eventually appear: "42 C" (when barista finishes) and "42 O" (when counter finishes) |
| Tap a badge in the right panel | Badge disappears from right panel and from `/pickup`; Open tab shows part as Picked Up |
| Tap only the "C" badge of an order with both parts | Only C badge disappears; O badge remains |
| Server marks order delivered from Open tab | Corresponding badge disappears from right panel and `/pickup` |
| Order cancelled | Card removed from prep queue; any badges for that order removed from right panel and `/pickup` |
| Server restarts or connection drops | Reconnected toast shown; both panels reload to current state |
