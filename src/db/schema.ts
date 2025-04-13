import {
  integer,
  pgTable,
  varchar,
  json,
  timestamp,
  text,
  primaryKey,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";

// Table for websites/projects being tracked
export const websites = pgTable("websites", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  apiKey: text("api_key").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Table for tracking page views
export const pageViews = pgTable("page_views", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  domain: text("domain").notNull(),
  route: text("route").notNull(),
  count: integer("count").default(1),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  additionalData: json("additional_data"),
  websiteId: text("website_id").references(() => websites.id),
});

// Table for tracking user locations
export const userLocations = pgTable("user_locations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  pageViewId: text("page_view_id").references(() => pageViews.id),
  country: text("country"),
  countryCode: text("country_code"),
  region: text("region"),
  city: text("city"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  ipAddress: text("ip_address"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Define relations
export const websiteRelations = relations(websites, ({ many }) => ({
  pageViews: many(pageViews),
}));

export const pageViewRelations = relations(pageViews, ({ one, many }) => ({
  website: one(websites, {
    fields: [pageViews.websiteId],
    references: [websites.id],
  }),
  userLocations: many(userLocations),
}));

export const userLocationRelations = relations(userLocations, ({ one }) => ({
  pageView: one(pageViews, {
    fields: [userLocations.pageViewId],
    references: [pageViews.id],
  }),
}));
