import { pgTable, text, varchar, timestamp, index } from 'drizzle-orm/pg-core';

export const hotTopics = pgTable('hot_topics', {
  id: text('id').primaryKey(),
  icon: varchar('icon', { length: 20 }).notNull(),
  title: varchar('title', { length: 100 }).notNull(),
  description: varchar('description', { length: 200 }).notNull(),
  query: text('query').notNull(),
  batchId: text('batch_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => ({
  batchIdIdx: index('idx_hot_topics_batch_id').on(table.batchId),
  createdAtIdx: index('idx_hot_topics_created_at').on(table.createdAt)
}));