import { Hono } from "hono";
import { logger } from "hono/logger";
import db from "./db";
import { pageViews, userLocations, websites } from "./db/schema";
import { serveStatic } from "hono/bun";
import { createId } from "@paralleldrive/cuid2";
import { cors } from "hono/cors";
import { eq } from "drizzle-orm";
import { Event, IpGeoLocation } from "./types";

const app = new Hono();

// Custom logger function
const logRequest = (
  method: string,
  endpoint: string,
  data: any,
  result: any,
  error?: any
) => {
  const timestamp = new Date().toISOString();
  const status = error ? "ERROR" : "SUCCESS";

  console.log(`[${timestamp}] ${method} ${endpoint} - ${status}`);
  console.log("Request:", JSON.stringify(data, null, 2));

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Response:", JSON.stringify(result, null, 2));
  }
  console.log("-----------------------------------");
};

app.use("*", logger());
app.use("/public/*", serveStatic({ root: "./" }));
app.use("*", cors());

app.get("/", async (c) => {
  const pageViews = await db.query.pageViews.findMany({
    orderBy: (pageViews, { desc }) => [desc(pageViews.timestamp)],
  });
  const websites = await db.query.websites.findMany();
  const userLocations = await db.query.userLocations.findMany();
  return c.json({ pageViews, websites, userLocations });
});

// Generate a new tracking code (API key) for a website
app.post("/websites", async (c) => {
  const body = await c.req.json();

  try {
    if (!body.name || !body.domain) {
      const error = "Name and domain are required";
      logRequest("POST", "/websites", body, null, error);
      return c.json({ error }, 400);
    }

    // Generate a unique API key as the tracking code
    const apiKey = createId();

    const website = await db
      .insert(websites)
      .values({
        name: body.name,
        domain: body.domain,
        apiKey,
      })
      .returning();

    const result = website[0];
    logRequest("POST", "/websites", body, result);
    return c.json(result);
  } catch (error) {
    logRequest("POST", "/websites", body, null, error);
    return c.json({ error: "Failed to create website" }, 500);
  }
});

// Analytics endpoint
app.post("/analytics", async (c) => {
  const body = (await c.req.json()) as Event;

  try {
    if (!body.id) {
      const error = "Tracking ID is required";
      logRequest("POST", "/analytics", body, null, error);
      return c.json({ error }, 400);
    }

    // Get user's IP address
    const ipAddress =
      c.req.header("X-Forwarded-For") ||
      c.req.header("CF-Connecting-IP") ||
      c.req.header("X-Real-IP") ||
      c.req.raw.headers.get("x-forwarded-for") ||
      "unknown";

    // Optionally validate ipAddress before fetching geo info
    if (ipAddress === "unknown") {
      console.warn("IP address unknown - location data may be limited");
    }

    let locationData: IpGeoLocation = {};
    try {
      // Use HTTPS for secure transmission
      const geoResponse = await fetch(`https://ip-api.com/json/${ipAddress}`);
      if (geoResponse.ok) {
        locationData = (await geoResponse.json()) as IpGeoLocation;
      } else {
        console.warn(
          `Geolocation API responded with status: ${geoResponse.status}`
        );
      }
    } catch (geoError) {
      console.warn("Failed to fetch location data:", geoError);
    }

    const website = await db.query.websites.findFirst({
      where: (websites, { eq }) => eq(websites.apiKey, body.id),
    });

    if (!website) {
      const error = "Invalid tracking ID";
      logRequest("POST", "/analytics", body, null, error);
      return c.json({ error }, 400);
    }

    let pageViewId: string | null = null;

    //check if page view already exists
    const isExistingPageView = await db.query.pageViews.findFirst({
      where: (pageViews, { and, eq }) =>
        and(
          eq(pageViews.domain, getDomain(body.u)),
          eq(pageViews.route, body.e.p.url)
        ),
    });

    if (isExistingPageView) {
      const pageView = await db
        .update(pageViews)
        .set({
          count: (isExistingPageView.count || 0) + 1,
          timestamp: new Date(), // Update timestamp to latest visit
        })
        .where(eq(pageViews.id, isExistingPageView.id))
        .returning()
        .then((res) => res[0]);

      pageViewId = isExistingPageView.id;
      console.log(
        `Updated existing page view: ${pageViewId}, new count: ${pageView.count}`
      );
    } else {
      const pageView = await db
        .insert(pageViews)
        .values({
          domain: getDomain(body.u),
          route: body.e.p.url,
          referrer: body.e.p.referrer,
          userAgent: body.e.p.userAgent,
          timestamp: body.e.p.timestamp,
          websiteId: website.id,
          additionalData: body.e.p.data,
          count: 1,
        })
        .returning()
        .then((res) => res[0]);

      pageViewId = pageView.id;
      console.log(`Created new page view: ${pageViewId}`);
    }

    const locationToInsert = {
      pageViewId: pageViewId,
      country: locationData.country,
      countryCode: locationData.countryCode,
      region: locationData.regionName,
      city: locationData.city,
      latitude: locationData.lat?.toString(),
      longitude: locationData.lon?.toString(),
      ipAddress: ipAddress,
    };

    await db.insert(userLocations).values(locationToInsert);

    const result = {
      success: true,
      id: pageViewId,
      ip: ipAddress,
      location: locationData,
    };

    logRequest("POST", "/analytics", body, result);
    return c.json(result);
  } catch (error) {
    logRequest("POST", "/analytics", body, null, error);
    return c.json({ error: "Failed to process analytics data" }, 500);
  }
});

export default app;

const getDomain = (url: string) => {
  const urlObj = new URL(url);
  return urlObj.hostname;
};
