# TrendBits Backend

A simple Express.js API with TypeScript and SQLite Cloud.

## Features

- User registration and login
- SQLite Cloud database integration
- TypeScript for type safety
- Simple input sanitization
- Database migrations

## Tech Stack

- **Express.js** - Web framework
- **TypeScript** - Type-safe JavaScript
- **SQLite Cloud** - Cloud database
- **dotenv** - Environment variables
- **CORS** - Cross-origin resource sharing

## Setup

1. Install dependencies:

```bash
yarn install
```

2. Create a `.env` file:

```env
DATABASE_URL=sqlitecloud://your-database-url
PORT=3000
DB_MAX_RETRY_ATTEMPTS=3
DB_RETRY_DELAY=2000
```

3. Run database migrations:

```bash
yarn migrate
```

4. Start the server:

```bash
yarn start
```

## API Endpoints

API documentation is available in [Postman](https://bankaapp.postman.co/workspace/My-Workspace~d15bd32e-3934-4d2e-87b2-30d34e6543be/collection/18217938-3fd77c50-fb3f-4740-9e19-251c44817945?action=share&source=copy-link&creator=18217938).

## Scripts

- `yarn start` - Start the server
- `yarn dev` - Start in development mode
- `yarn migrate` - Run database migrations

## Project Structure

```
src/
├── configs/
│   └── database.ts          # Database connection setup
├── controllers/
│   └── auth.controller.ts   # Authentication logic
├── middlewares/
│   └── database.middleware.ts # Input sanitization & query wrapper
├── migrations/
│   └── 001_create_users.sql # Database schema
├── routes/
│   ├── auth.routes.ts       # Authentication routes
│   └── index.ts             # Route aggregation
├── utils/
│   └── migration_runner.ts  # Database migration runner
└── server.ts                # Main application entry point
```

## Environment Variables

| Variable                | Description                    | Default  |
| ----------------------- | ------------------------------ | -------- |
| `DATABASE_URL`          | SQLite Cloud connection string | Required |
| `PORT`                  | Server port                    | 3000     |
| `DB_MAX_RETRY_ATTEMPTS` | Database connection retries    | 3        |
| `DB_RETRY_DELAY`        | Retry delay in milliseconds    | 2000     |

## Development

The application uses a simple architecture:

- Routes handle HTTP requests
- Controllers contain business logic
- Middlewares provide input sanitization
- Database config manages connections
- Migrations handle schema changes

Run migrations before starting the server for the first time.
