import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const trendHistory = pgTable('trend_history', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  searchTerm: text('search_term').notNull(),
  headline: text('headline').notNull(),
  summary: text('summary').notNull(),
  keyPoints: text('key_points').notNull(),
  callToAction: text('call_to_action').notNull(),
  articleReferences: text('article_references'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => ({
  userIdIdx: index('idx_trend_history_user_id').on(table.userId),
  createdAtIdx: index('idx_trend_history_created_at').on(table.createdAt),
  userCreatedIdx: index('idx_trend_history_user_created').on(table.userId, table.createdAt),
  searchTermIdx: index('idx_trend_history_search_term').on(table.searchTerm)
}));

export const trendHistoryRelations = relations(trendHistory, ({ one }) => ({
  user: one(users, {
    fields: [trendHistory.userId],
    references: [users.id]
  })
}));