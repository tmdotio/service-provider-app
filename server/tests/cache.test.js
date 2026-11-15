import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Fake in-memory Redis for this file only (no real Redis needed)
const store = vi.hoisted(() => new Map());
vi.mock("../src/config/redis.js", () => {
  const client = {
    isReady: true,
    get: vi.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    set: vi.fn(async (key, value) => {
      store.set(key, value);
    }),
    del: vi.fn(async (keys) => {
      [].concat(keys).forEach((key) => store.delete(key));
    }),
    incr: vi.fn(async (key) => {
      const next = Number(store.get(key) || 0) + 1;
      store.set(key, String(next));
      return next;
    }),
  };
  return { default: client, connectRedis: async () => {} };
});

const { default: redisClient } = await import("../src/config/redis.js");
const { default: ServiceProvider } = await import("../src/models/serviceProvider.model.js");
const { api, auth, createAdmin, createApprovedProvider, createCategory } = await import("./helpers.js");

let admin;
let category;

beforeAll(async () => {
  admin = await createAdmin();
  category = await createCategory("Electrician");
});

afterEach(() => {
  redisClient.isReady = true;
  vi.restoreAllMocks();
});

describe("Redis cache for providers", () => {
  it("serves the same search from Redis the second time", async () => {
    await createApprovedProvider({ admin, category, name: "Cache" });
    const spy = vi.spyOn(ServiceProvider, "aggregate");

    const first = await api().get("/api/provider?city=Lahore&sort=rating");
    // Same filters in a different order and case -> same cache key
    const second = await api().get("/api/provider?sort=rating&city=LAHORE");

    expect(first.status).toBe(200);
    expect(second.body.providers).toEqual(first.body.providers);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("a provider change clears the cache, so the next search is fresh", async () => {
    const pro = await createApprovedProvider({ admin, category, name: "Fresh" });
    const url = `/api/provider?q=Fresh Services`;

    const before = await api().get(url);
    expect(before.body.providers[0].availabilityStatus).toBe("available");

    await api()
      .patch("/api/provider/me/availability")
      .set(auth(pro.token))
      .send({ availabilityStatus: "offline" });

    const after = await api().get(url);
    expect(after.body.providers[0].availabilityStatus).toBe("offline");
  });

  it("caches the public profile and refreshes it after a change", async () => {
    const pro = await createApprovedProvider({ admin, category, name: "Profile" });
    const url = `/api/provider/${pro.providerId}`;
    const spy = vi.spyOn(ServiceProvider, "findOne");

    await api().get(url);
    await api().get(url);
    const lookups = spy.mock.calls.length;
    expect(lookups).toBe(1);

    await api()
      .patch("/api/provider/me")
      .set(auth(pro.token))
      .send({ description: "New description" });

    const res = await api().get(url);
    expect(res.body.provider.description).toBe("New description");
  });

  it("still works when Redis is down", async () => {
    redisClient.isReady = false;
    const res = await api().get("/api/provider?city=Karachi");
    expect(res.status).toBe(200);
  });
});
