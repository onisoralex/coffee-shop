# Manual — Management Screen (`/management`)

The management screen is the administrative interface. It requires a password to access. Changes made here take effect immediately across all screens.

---

## Login

When no valid session exists, the screen shows a login form with a single password field.

- Press **Enter** or click the login button to submit.
- On success, a session token is stored in the browser and the management interface loads.
- On failure, an inline error message is shown.
- The default password is set via the `.env` file on first setup. It can be changed from the Settings tab after login.
- Closing the browser tab does not log you out. The session persists until you explicitly sign out (button in the management shell) or the token expires.

---

## Menu tab

Displays the full menu in a category accordion. Each category can be expanded to see its items.

### Categories

**Category header** shows:
- Category name
- A "Paused" chip when the category is paused
- Pause / Resume button
- Edit button
- Delete button

**Adding a category:** Click the **+ Category** button at the top of the tab. A dialog opens asking for name and sort order.

**Editing a category:** Click the edit icon on the category row. Same dialog, pre-filled.

**Sort order:** Controls the display sequence in the menu. Categories with lower sort order values appear first. New categories default to sort order 1.

**Deleting a category:** Blocked if the category contains any items. The system returns a conflict error and the deletion does not proceed. Remove or move all items first.

**Pausing a category:** The Pause button immediately hides the entire category from the Ordering screen for all devices. No items in the category can be ordered while it is paused. The Resume button reverses this. Use this to temporarily hide a category during a shortage without deleting anything.

### Items

Within each expanded category, items are listed as rows showing:
- Item name
- Description (if set)
- Composition in italics (if set)
- Availability toggle switch
- Edit button
- Delete button

**Availability toggle:** Flipping this to unavailable immediately removes the item from the Ordering screen. It remains in the management list and can be re-enabled at any time.

**Adding an item:** Click the **+ Item** button inside a category. A dialog opens with the following fields:

| Field | Notes |
|-------|-------|
| Name | Required |
| Description | Optional; shown on item cards in ordering screen if the "Show description" setting is on |
| Composition | Optional; shown below description if the "Show composition" setting is on |
| Image | Optional; see Image section below |
| Type | COFFEE or OTHER — determines which kitchen screen handles the item |
| EE (espresso equivalent) | Decimal; number of espresso portions per serving; used in order summary stats |
| ME (milk equivalent, ml) | Decimal; milk per serving in ml; used in order summary stats |
| Sort order | Controls display order within the category; defaults to 1 |
| Available | Whether the item is shown on the ordering screen |

**Editing an item:** Same dialog, pre-filled. All fields can be changed.

**Deleting an item:** Blocked if any orders reference that item. If blocked, the item cannot be removed until all associated orders are gone. Toggle it to unavailable instead.

#### Image field

Two modes, switchable in the dialog:

- **External URL:** Paste a full URL to an image hosted elsewhere. The ordering screen will load it directly.
- **Upload:** Choose a file from disk. The image is uploaded to the server immediately on file selection and a live preview appears. Supported formats: common image MIME types (JPEG, PNG, etc.).

Switching between modes preserves the current value. Clearing the image removes it from the item card.

Images are rendered at a fixed height (120px) with the full image visible (no cropping). Whether images are shown at all is controlled by the "Show item image" toggle in Settings.

#### Item translations

The item dialog has a Translations section below the main fields. Two languages are supported for translation: **Deutsch (DE)** and **Română (RO)**.

For each language, you can provide a translated description and/or composition. The English values (in the main fields) serve as the fallback for any language that has no translation row.

Translations are saved after the main item is saved. If both fields for a language are left blank, no translation row is stored for that language — it falls back to English.

---

## Tables tab

Lists all tables in the system.

### Bar table

The Bar table is a permanent, system-managed table. It:
- Cannot be deleted
- Cannot have its QR rotated (it has no QR code — bar orders are placed directly by staff)
- Always appears in the table picker on the Ordering screen as the default selection

### Regular tables

Each table row shows:
- Table number
- Label (optional)
- QR token

**Adding a table:** Click **+ Table**. Provide a table number (must be unique) and an optional label. A QR token is generated automatically.

**Deleting a table:** Blocked if any orders exist for that table. The system returns a conflict error. If you need to remove a table that has historical orders, those orders would need to be resolved first.

**NEW QR CODE button:** Rotates the QR token. A confirmation step is shown before the rotation. After rotation, the old QR code (printed or stuck to the table) stops working — anyone scanning it will get an error. The new token is immediately available for generating a new QR download.

### QR code dialog

Click the QR icon on a table row to open the QR dialog. It shows:
- A live styled QR code preview (with dot shapes, gradient, and logo)
- A **Download PNG** button that saves the QR image to disk

The QR encodes a URL in the format `{base-url}/order?table={token}`. The base URL defaults to the server's own origin but can be overridden in Settings (necessary when devices access the server via a local network IP rather than localhost).

---

## Orders tab

Shows order history with a date-range filter.

### Filters

- **From / To date pickers:** Defaults to the current day (today → today). Adjust to view historical data.
- **Refresh button:** Re-fetches orders with the current filter. Use this after placing test orders to see them appear.

The endpoint returns a maximum of 200 orders per query.

### Summary cards

Three stat cards appear above the order list:

- **Orders:** Total count of non-cancelled orders in the selected range
- **Coffee equivalent (portions):** Sum of EE (espresso-equivalent) values across all non-cancelled order items
- **Milk (L):** Sum of ME (milk-equivalent) values, converted from ml to litres

A per-item breakdown card below the stats shows quantity, EE portions, and milk (L) for every item that appears in the results. Columns show `—` when the value is zero.

### Order list

Each order row shows: order number, table, time placed, coffee status chip, other status chip (when present).

**Expanding a row** reveals the full item list with quantities, notes, and the status of each part.

Status chips use translated labels (not raw system values). An order with only coffee items has no "other" chip, and vice versa.

---

## Settings tab

### Password change

Three fields: current password, new password, confirm new password.

- New password must be at least 8 characters.
- The fields validate inline (length, mismatch) before the form can be submitted.
- On success, a confirmation message is shown. The session token remains valid — you are not logged out.

### Language

A dropdown to select the interface language: **English**, **Deutsch**, or **Română**.

- Applies globally to all screens and all connected devices.
- Takes effect immediately; no page refresh needed.
- Romanian includes proper plural forms for item counts.

### Appearance

A **Dark mode** toggle. Switches all screens to a dark theme globally. Takes effect immediately.

### Menu item display

Three toggles controlling what appears on item cards in the Ordering screen:

| Toggle | Controls |
|--------|---------|
| Show description | Item description text below the name |
| Show composition | Composition text below description |
| Show item image | Image above the item name |

These apply globally to all devices. They do not affect the management screen itself.

### QR base URL

A text field for the base URL used when generating QR codes in the Tables tab. Leave blank to use the server's own origin (`window.location.origin`). Set this to the server's local network IP address (e.g., `http://192.168.1.50:3001`) so that QR codes work on customer phones that cannot resolve `localhost`.

---

## Expected tester behaviors

| Scenario | Expected result |
|----------|----------------|
| Log in with correct password | Management shell loads |
| Log in with wrong password | Inline error shown; no navigation |
| Toggle item availability off | Item disappears from ordering screen immediately |
| Toggle item availability on | Item reappears on ordering screen immediately |
| Pause a category | Entire category disappears from ordering screen; "Paused" chip shown in management |
| Resume a category | Category reappears on ordering screen |
| Delete a category that has items | Error; deletion blocked |
| Delete an item that has orders | Error; deletion blocked |
| Rotate QR code | Confirmation dialog shown; after confirm, old token invalid; new QR available |
| Delete Bar table | Not possible; delete button not present |
| Change password to fewer than 8 chars | Inline validation error; form cannot be submitted |
| Change language to Deutsch | All screen labels switch to German immediately on all connected devices |
| Toggle dark mode | All screens switch to dark theme immediately |
| Upload an image for an item | Preview shown in dialog immediately; after save, image appears on ordering screen |
| Set QR base URL to network IP | QR codes generated in the Tables tab encode the new base URL |
| Open Orders tab, set date range | Orders within that range shown; summary stats update accordingly |
