# Soul — Vision & Design Principles

## What we're building
A system that gets out of the way. Customers should order without frustration. Baristas should never wonder what to make next. The pickup display should be readable from across a room. The management interface should be self-explanatory.

## Design principles

### 1. Speed over features
Every interaction has a time cost. A customer at a kiosk wants to order and sit down. A barista glancing at the prep screen between shots needs information at a glance. Never add UI complexity without asking: does this make the primary action faster or slower?

### 2. Designed for real conditions
- The kiosk will be touched with wet and greasy fingers. Touch targets must be large (minimum 48×48px).
- The barista screen is in a loud, hot environment. Color and iconography must carry meaning — don't rely on small text.
- The pickup display is viewed from distance. Order numbers should be visible at 3 meters.
- Mobile ordering happens on customer phones with varying screen sizes and in varying lighting. High contrast.

### 3. Failure is visible, not silent
If the socket disconnects, show a banner. If an order submission fails, say why. If the menu fails to load, show a retry button. Never leave the user staring at a spinner with no feedback path.

### 4. Progressive disclosure in management
The management interface is used by staff who may not be technical. Lead with the most common actions (toggle availability, change price). Destructive actions (delete category, rotate QR) are behind a confirm step.

### 5. Real-time is a feature, not an afterthought
The entire value of this system over a paper ticket system is live updates. Every view that can benefit from real-time must use it. The prep screen should never require a refresh. The coordinator view is a live dashboard, not a page you reload.

## View personality

| View | Personality | Primary color usage |
|------|-------------|---------------------|
| Ordering | Warm, inviting, like a café menu | Brand accent color, food photography |
| Prep | Functional, dense, no decoration | High contrast, urgency colors (amber, red) |
| Coordinator | Overview, calm, informational | Status colors in kanban columns |
| Pickup | Celebratory when your number appears | Large, high contrast, minimal |
| Management | Professional, neutral | Standard MUI palette |

## The 60-second ordering rule
A customer sitting down at a table should be able to scan a QR code, browse the menu, add items to their cart, and submit an order in under 60 seconds. Any UX decision that risks breaking this should require explicit justification.

## What this is not
- A POS system (no payment)
- A loyalty program
- An analytics platform
- A multi-location franchise tool

Scope creep in these directions will compromise the core experience. Build the core brilliantly before adding periphery.
