import { pgTable, text, varchar, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { trendHistory } from './history';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: varchar('username', { length: 50 }),
  email: varchar('email', { length: 100 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  resetToken: text('reset_token'),
  resetTokenExpires: timestamp('reset_token_expires'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const usersRelations = relations(users, ({ many }) => ({
  trendHistory: many(trendHistory)
}));