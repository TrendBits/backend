import { pgTable, text, integer, index } from 'drizzle-orm/pg-core';

export const guestRequests = pgTable('guest_requests', {
  id: text('id').primaryKey(),
  ipAddress: text('ip_address').notNull(),
  requestCount: integer('request_count').default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
}, (table) => ({
  ipIdx: index('idx_guest_requests_ip').on(table.ipAddress)
}));