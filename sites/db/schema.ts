import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const goalStates = sqliteTable('goal_states', {
  ownerId: text('owner_id').primaryKey(),
  stateJson: text('state_json').notNull(),
  revision: integer('revision').notNull(),
  updatedAt: text('updated_at').notNull(),
});
