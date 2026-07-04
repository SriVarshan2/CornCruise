import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  // Config loader may run during static analysis where environment is not fully loaded.
  // We can provide a placeholder or just check it. Let's make it safe so it doesn't fail compilation.
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/placeholder',
  },
});
