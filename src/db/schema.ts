// Export all tables
export * from './schemas/users';
export * from './schemas/trends';
export * from './schemas/history';
export * from './schemas/guest';

// If you want to create a combined schema object for Drizzle
import { users, usersRelations } from './schemas/users';
import { hotTopics } from './schemas/trends';
import { trendHistory, trendHistoryRelations } from './schemas/history';
import { guestRequests } from './schemas/guest';

export const schema = {
  users,
  usersRelations,
  hotTopics,
  trendHistory,
  trendHistoryRelations,
  guestRequests
};