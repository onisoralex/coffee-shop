# coffee-shop

## Set-Up
1. Clone the repo
2. Copy `.env.example` to `.env`
3. Run `docker compose up -d`
4. To populate the database with basic entries run `docker compose exec server npm run db:seed --workspace=server`
4. Call the different views at `http://localhost:3001`
    - /order - You can order items. Call it with `?table=<UUID_of_table>` to get the view that the QR code will open
    - /barista - The view of the personnel making the coffee
    - /counter - The persons making the orher orders and managing the pick-up screen
    - /pickup - Pick-up screen that shows the orders that can be picked up
    - /management - Management inteface to change settings (default password in in `.env` file and can be changed in settings on management screen)
