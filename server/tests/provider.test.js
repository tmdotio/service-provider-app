import { beforeAll, describe, expect, it } from "vitest";
import User from "../src/models/user.model.js";
import {
  api,
  auth,
  createAdmin,
  createApprovedProvider,
  createCategory,
  createCustomer,
  pngBuffer,
} from "./helpers.js";

let admin;
let plumbing;
let painting;

beforeAll(async () => {
  admin = await createAdmin();
  plumbing = await createCategory("Plumbing");
  painting = await createCategory("Painting");
});

describe("Provider search & profile", () => {
  it("filters by category and city, hides inactive users and pending applications", async () => {
    const lahore = await createApprovedProvider({ admin, category: plumbing, name: "Ahmed" });
    await createApprovedProvider({ admin, category: plumbing, city: "Karachi", name: "Kamran" });
    await createApprovedProvider({ admin, category: painting, name: "Pervez" });

    // Pending (not approved) application should not appear
    const pending = await createCustomer("Pending");
    await api()
      .post("/api/provider/become-provider")
      .set(auth(pending.token))
      .send({
        businessName: "Pending Plumbing",
        businessPhone: "03001234567",
        experienceYears: 1,
        categories: [String(plumbing._id)],
        location: { city: "Lahore", province: "Punjab", country: "Pakistan" },
      });

    const res = await api().get(
      `/api/provider?category=${plumbing._id}&city=lahore`,
    );
    expect(res.status).toBe(200);
    expect(res.body.providers.map((p) => p.businessName)).toEqual(["Ahmed Services"]);
    expect(res.body.providers[0].businessPhone).toBeUndefined();

    // Deactivated user disappears from search
    await User.updateOne({ _id: lahore.user.id }, { isActive: false });
    const after = await api().get(`/api/provider?category=${plumbing._id}&city=Lahore`);
    expect(after.body.providers).toHaveLength(0);
  });

  it("text search is safe with special characters", async () => {
    const res = await api().get("/api/provider?q=(.*");
    expect(res.status).toBe(200);
  });

  it("public profile works and pagination is returned", async () => {
    const p = await createApprovedProvider({ admin, category: painting, name: "Zain" });
    const res = await api().get(`/api/provider/${p.providerId}`);
    expect(res.status).toBe(200);
    expect(res.body.provider.businessName).toBe("Zain Services");
    expect(res.body).toHaveProperty("latestReviews");
    expect(res.body.provider.businessPhone).toBeUndefined();

    const search = await api().get("/api/provider?limit=1&page=1");
    expect(search.body.pagination).toMatchObject({ page: 1, limit: 1 });
  });

  it("availability: cannot set busy manually", async () => {
    const p = await createApprovedProvider({ admin, category: painting, name: "Rizwan" });
    const res = await api()
      .patch("/api/provider/me/availability")
      .set(auth(p.token))
      .send({ availabilityStatus: "busy" });
    expect(res.status).toBe(400);
  });

  it("provider can update own profile; customer cannot", async () => {
    const p = await createApprovedProvider({ admin, category: painting, name: "Faisal" });
    const ok = await api()
      .patch("/api/provider/me")
      .set(auth(p.token))
      .send({ description: "20 years painting homes", location: { city: "Multan" } });
    expect(ok.status).toBe(200);
    expect(ok.body.provider.location.city).toBe("Multan");
    expect(ok.body.provider.location.province).toBe("Punjab");

    const customer = await createCustomer();
    const denied = await api()
      .patch("/api/provider/me")
      .set(auth(customer.token))
      .send({ description: "x" });
    expect(denied.status).toBe(403);
  });
});

describe("Customer becomes a provider", () => {
  it("keeps the bookings they made as a customer", async () => {
    const pro = await createApprovedProvider({ admin, category: plumbing, name: "Hired" });
    const customer = await createCustomer("Switcher");
    const booked = await api()
      .post(`/api/booking/${pro.providerId}`)
      .set(auth(customer.token))
      .send({
        category: String(plumbing._id),
        description: "Bathroom tap is leaking badly",
        serviceAddress: "Gulberg, Lahore",
      });
    expect(booked.status).toBe(201);

    // Same person applies and is approved
    await api()
      .post("/api/provider/become-provider")
      .set(auth(customer.token))
      .send({
        businessName: "Switcher Repairs",
        businessPhone: "03001234567",
        experienceYears: 2,
        categories: [String(plumbing._id)],
        location: { city: "Lahore", province: "Punjab", country: "Pakistan" },
      });
    await api()
      .patch(`/api/admin/provider-requests/${customer.user.id}/review`)
      .set(auth(admin.token))
      .send({ action: "approve" });

    const mine = await api().get("/api/booking/customer").set(auth(customer.token));
    expect(mine.status).toBe(200);
    expect(mine.body.bookings).toHaveLength(1);
  });
});

describe("Provider banner", () => {
  it("provider uploads a banner; it shows on the public profile; customers cannot", async () => {
    const p = await createApprovedProvider({ admin, category: painting, name: "Banner" });
    const res = await api()
      .patch("/api/provider/me/banner")
      .set(auth(p.token))
      .attach("image", pngBuffer(), { filename: "cover.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(res.body.bannerImage.url).toMatch(/^https:/);

    const profile = await api().get(`/api/provider/${p.providerId}`);
    expect(profile.body.provider.bannerImage.url).toBe(res.body.bannerImage.url);

    const customer = await createCustomer();
    const denied = await api()
      .patch("/api/provider/me/banner")
      .set(auth(customer.token))
      .attach("image", pngBuffer(), { filename: "cover.png", contentType: "image/png" });
    expect(denied.status).toBe(403);
  });
});

describe("Categories & admin", () => {
  it("lists categories with provider counts", async () => {
    const res = await api().get("/api/categories");
    expect(res.status).toBe(200);
    const plumbingRow = res.body.categories.find((c) => c.name === "Plumbing");
    expect(plumbingRow.providersCount).toBeGreaterThanOrEqual(1);
  });

  it("cannot delete a category that providers use (bug fix)", async () => {
    const res = await api()
      .delete(`/api/admin/categories/${plumbing._id}`)
      .set(auth(admin.token));
    expect(res.status).toBe(409);
  });

  it("admin category create is validated", async () => {
    const res = await api()
      .post("/api/admin/categories")
      .set(auth(admin.token))
      .send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("dashboard stats include bookings, posts and reports", async () => {
    const res = await api().get("/api/admin/dashboard-stats").set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.stats).toHaveProperty("bookingsByStatus");
    expect(res.body.stats).toHaveProperty("pendingReports");
    expect(res.body.stats).toHaveProperty("topProviders");
  });

  it("approved provider gets a notification", async () => {
    const p = await createApprovedProvider({ admin, category: painting, name: "Naveed" });
    const res = await api().get("/api/notifications").set(auth(p.token));
    expect(res.body.notifications.map((n) => n.type)).toContain("provider_approved");

    const readAll = await api().patch("/api/notifications/read-all").set(auth(p.token));
    expect(readAll.status).toBe(200);
    const after = await api().get("/api/notifications").set(auth(p.token));
    expect(after.body.unreadCount).toBe(0);
  });

  it("/getusers is admin only", async () => {
    const customer = await createCustomer();
    expect((await api().get("/getusers")).status).toBe(401);
    expect((await api().get("/getusers").set(auth(customer.token))).status).toBe(403);
    expect((await api().get("/getusers").set(auth(admin.token))).status).toBe(200);
  });
});
