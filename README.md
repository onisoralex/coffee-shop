# coffee-shop

## Setup
1. Clone the repo
2. Copy `.env.example` to `.env`
3. Run `docker compose up -d`
4. To populate the database with basic entries run `docker compose exec server npm run db:seed --workspace=server`
5. Call the different views at `http://localhost:3001`
    - /order - You can order items. Call it with `?table=<UUID_of_table>` (to be found on the table tab in the management view) to get the view that the QR code will open
    - /barista - The view of the personnel making the coffee
    - /counter - The persons making the orher orders and managing the pick-up screen
    - /pickup - Pick-up screen that shows the orders that can be picked up
    - /management - Management inteface to change settings (default password in in `.env` file and can be changed in settings on management screen)

## Documentation

- [Overview & order lifecycle](docs/manual/00-overview.md)
- [Ordering screen](docs/manual/01-ordering.md) — `/order`
- [Barista screen](docs/manual/02-barista.md) — `/barista`
- [Counter screen](docs/manual/03-counter.md) — `/counter`
- [Pickup display](docs/manual/04-pickup.md) — `/pickup`
- [Management screen](docs/manual/05-management.md) — `/management`
- [Cross-cutting behaviors](docs/manual/06-cross-cutting.md) — language, dark mode, order numbers, real-time

## Teardown
1. To delete containers and database run `docker compose down -v`
