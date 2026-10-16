# Run Luxora without Docker

Install Node.js 24 and PostgreSQL 17 on your computer. Start PostgreSQL.

In pgAdmin, connect as your PostgreSQL administrator and open Query Tool for
postgres. Run the following commands separately (choose your own password):

```sql
CREATE USER luxora WITH PASSWORD 'your_password_here';
CREATE DATABASE luxora OWNER luxora;
```

Inside this Luxora folder, copy .env.example to .env. Set DATABASE_URL to:

```
DATABASE_URL=postgres://luxora:your_password_here@localhost:5432/luxora
PORT=3001
NODE_ENV=development
```

Use your actual password; URL-encode special characters in the URL.
Never share or commit your .env file.

Open a terminal in this folder and run:

```bash
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

The seed step is optional and adds fictional sample data. Skip it for an empty
workspace. Open http://localhost:5173 in your browser. Enter your business
information in Business settings.

On later runs, start PostgreSQL and run npm run dev. Press Ctrl+C to stop the app.
No Docker commands are needed. See README.md for features and limitations.

Tests create disposable databases and require CREATEDB permission, which is not
needed for normal application use. Have an administrator grant that permission
only if you need to run the test suites.
