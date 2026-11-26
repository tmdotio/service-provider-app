import { createServer } from "node:http";
import { io as connect } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import Conversation from "../src/models/conversation.model.js";
import ServiceProvider from "../src/models/serviceProvider.model.js";
import User from "../src/models/user.model.js";
import { setIO } from "../src/socket/emitter.js";
import { initSocket } from "../src/socket/index.js";
import {
  api,
  auth,
  completeJob,
  createAdmin,
  createApprovedProvider,
  createCategory,
  createCustomer,
  pngBuffer,
} from "./helpers.js";

let admin;
let category;
let httpServer;
let url;
const sockets = [];

const book = (who, providerId, cat = category) =>
  api()
    .post(`/api/booking/${providerId}`)
    .set(auth(who.token))
    .send({ category: String(cat._id), description: "Lights keep flickering at night", serviceAddress: "Gulberg, Lahore" });

const socketFor = (who) =>
  new Promise((resolve, reject) => {
    const s = connect(url, { auth: { token: who.token }, transports: ["websocket"], forceNew: true });
    sockets.push(s);
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
  });

beforeAll(async () => {
  admin = await createAdmin();
  category = await createCategory("Solar Technician");
  httpServer = createServer(app);
  initSocket(httpServer, { origins: "*" });
  await new Promise((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${httpServer.address().port}`;
});

afterAll(async () => {
  sockets.forEach((s) => s.disconnect());
  setIO(null);
  await new Promise((resolve) => httpServer.close(resolve));
});

describe("Admin: users", () => {
  it("lists users a page at a time, with search (safe for regex characters) and role filter", async () => {
    await createCustomer("Zubair (a+b) Search");
    await createCustomer("Second");
    await createCustomer("Third");
    const res = await api().get("/api/admin/users?limit=2").set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(res.body.pagination.total).toBeGreaterThan(2);
    expect(res.body.users.some((u) => u.role === "admin")).toBe(false);
    expect(res.body.users[0].password).toBeUndefined();

    const found = await api().get(`/api/admin/users?q=${encodeURIComponent("(a+b)")}`).set(auth(admin.token));
    expect(found.body.users.map((u) => u.name)).toEqual(["Zubair (a+b) Search"]);

    const providers = await api().get("/api/admin/users?role=provider").set(auth(admin.token));
    expect(providers.body.users.every((u) => u.role === "provider")).toBe(true);
  });

  it("only admins can use admin routes", async () => {
    const customer = await createCustomer();
    expect((await api().get("/api/admin/users").set(auth(customer.token))).status).toBe(403);
    expect((await api().get("/api/admin/users")).status).toBe(401);
  });

  it("single user details hide secrets", async () => {
    const customer = await createCustomer("Detail");
    const res = await api().get(`/api/admin/users/${customer.user.id}`).set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/password|refreshToken/);
  });

  it("deactivating a user: logged out everywhere, chat socket closed, hidden from search; activating brings them back", async () => {
    const provider = await createApprovedProvider({ admin, category, name: "Deactivate me" });
    const socket = await socketFor(provider);
    const closed = new Promise((resolve) => socket.on("disconnect", resolve));

    const res = await api()
      .patch(`/api/admin/users/${provider.user.id}/status`)
      .set(auth(admin.token))
      .send({ isActive: false });
    expect(res.status).toBe(200);
    await closed; // the live connection was dropped at once

    expect((await User.findById(provider.user.id).select("+refreshToken")).refreshToken).toBeNull();
    expect((await api().get("/api/auth/get-me").set(auth(provider.token))).status).toBe(403);
    await expect(socketFor(provider)).rejects.toThrow("unauthorized");

    const search = await api().get(`/api/provider?category=${category._id}`);
    expect(search.body.providers.map((p) => p._id)).not.toContain(provider.providerId);
    const cats = await api().get("/api/categories");
    expect(cats.body.categories.find((c) => c.name === "Solar Technician").providersCount).toBe(0);

    await api().patch(`/api/admin/users/${provider.user.id}/status`).set(auth(admin.token)).send({ isActive: true });
    const after = await api().get("/api/categories");
    expect(after.body.categories.find((c) => c.name === "Solar Technician").providersCount).toBe(1);
  });

  it("deleting a user removes their provider profile and their chats; admins cannot be deleted", async () => {
    const provider = await createApprovedProvider({ admin, category, name: "Delete me" });
    const customer = await createCustomer("Chatty");
    const booking = await book(customer, provider.providerId);
    const chat = await api().post("/api/chats").set(auth(customer.token)).send({ bookingId: booking.body.booking._id });
    expect(chat.status).toBe(200);

    const res = await api().delete(`/api/admin/users/${provider.user.id}`).set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(await ServiceProvider.exists({ _id: provider.providerId })).toBeNull();
    expect(await Conversation.exists({ _id: chat.body.conversation._id })).toBeNull();

    expect((await api().delete(`/api/admin/users/${admin.user.id}`).set(auth(admin.token))).status).toBe(403);
  });
});

describe("Admin: providers, applications and bookings", () => {
  it("lists providers and pending applications, and shows one provider", async () => {
    const provider = await createApprovedProvider({ admin, category, name: "Listed" });
    const list = await api().get("/api/admin/providers").set(auth(admin.token));
    expect(list.status).toBe(200);
    expect(list.body.providers.length).toBeGreaterThan(0);

    const one = await api().get(`/api/admin/providers/${provider.user.id}`).set(auth(admin.token));
    expect(one.status).toBe(200);
    expect(one.body.provider.businessName).toBe("Listed Services");

    const applicant = await createCustomer("Applicant");
    await api()
      .post("/api/provider/become-provider")
      .set(auth(applicant.token))
      .send({
        businessName: "Applicant Works",
        businessPhone: "03001112222",
        description: "New here",
        experienceYears: 2,
        categories: [String(category._id)],
        location: { city: "Lahore", province: "Punjab", country: "Pakistan" },
      });
    const pending = await api().get("/api/admin/provider-requests/pending").set(auth(admin.token));
    expect(JSON.stringify(pending.body)).toContain("Applicant Works");

    // The applicant can see their own application status
    const mine = await api().get("/api/provider/application").set(auth(applicant.token));
    expect(mine.body.application.verificationStatus).toBe("pending");
  });

  it("rejecting an application needs a reason and tells the applicant", async () => {
    const applicant = await createCustomer("Rejected one");
    await api()
      .post("/api/provider/become-provider")
      .set(auth(applicant.token))
      .send({
        businessName: "Too Early",
        businessPhone: "03001113333",
        description: "Trying",
        experienceYears: 1,
        categories: [String(category._id)],
        location: { city: "Lahore", province: "Punjab", country: "Pakistan" },
      });
    const reviewUrl = `/api/admin/provider-requests/${applicant.user.id}/review`;
    expect((await api().patch(reviewUrl).set(auth(admin.token)).send({ action: "reject" })).status).toBe(400);
    const res = await api().patch(reviewUrl).set(auth(admin.token)).send({ action: "reject", rejectionReason: "Add a CNIC copy" });
    expect(res.status).toBe(200);

    const notes = await api().get("/api/notifications").set(auth(applicant.token));
    expect(notes.body.notifications[0].type).toBe("provider_rejected");
    expect(notes.body.notifications[0].message).toMatch(/Add a CNIC copy/);
  });

  it("admin updates a provider's profile", async () => {
    const provider = await createApprovedProvider({ admin, category, name: "Edit by admin" });
    const res = await api()
      .patch(`/api/admin/providers/${provider.user.id}`)
      .set(auth(admin.token))
      .send({ businessName: "Renamed by Admin" });
    expect(res.status).toBe(200);
    expect((await ServiceProvider.findById(provider.providerId)).businessName).toBe("Renamed by Admin");
  });

  it("lists all bookings with a status filter", async () => {
    const provider = await createApprovedProvider({ admin, category, name: "Bookings list" });
    const customer = await createCustomer();
    await book(customer, provider.providerId);
    const all = await api().get("/api/admin/bookings").set(auth(admin.token));
    expect(all.status).toBe(200);
    expect(all.body.bookings.length).toBeGreaterThan(0);
    const pending = await api().get("/api/admin/bookings?status=pending").set(auth(admin.token));
    expect(pending.body.bookings.every((b) => b.status === "pending")).toBe(true);
  });
});

describe("Other features", () => {
  it("a booking can be opened only by its customer, its provider or an admin", async () => {
    const provider = await createApprovedProvider({ admin, category, name: "Open booking" });
    const customer = await createCustomer();
    const stranger = await createCustomer();
    const { body } = await book(customer, provider.providerId);
    const path = `/api/booking/${body.booking._id}`;
    expect((await api().get(path).set(auth(customer.token))).status).toBe(200);
    expect((await api().get(path).set(auth(provider.token))).status).toBe(200);
    expect((await api().get(path).set(auth(admin.token))).status).toBe(200);
    expect((await api().get(path).set(auth(stranger.token))).status).toBe(403);
  });

  it("customer edits and deletes their review; the rating follows", async () => {
    const provider = await createApprovedProvider({ admin, category, name: "Rated" });
    const customer = await createCustomer();
    const other = await createCustomer();
    const bookingId = await completeJob({ customer, provider, category });
    const created = await api().post(`/api/booking/${bookingId}/review`).set(auth(customer.token)).send({ rating: 2 });
    const id = created.body.review._id;

    expect((await api().patch(`/api/reviews/${id}`).set(auth(other.token)).send({ rating: 5 })).status).toBe(403);
    expect((await api().patch(`/api/reviews/${id}`).set(auth(customer.token)).send({ rating: 5 })).status).toBe(200);
    expect((await ServiceProvider.findById(provider.providerId)).averageRating).toBe(5);

    expect((await api().delete(`/api/reviews/${id}`).set(auth(customer.token))).status).toBe(200);
    const after = await ServiceProvider.findById(provider.providerId);
    expect(after.totalReviews).toBe(0);
    // ...and the booking can be reviewed again
    expect((await api().post(`/api/booking/${bookingId}/review`).set(auth(customer.token)).send({ rating: 4 })).status).toBe(201);
  });

  it("profile photo upload: only real images under 1 MB", async () => {
    const customer = await createCustomer();
    const ok = await api()
      .patch("/api/upload/avatar")
      .set(auth(customer.token))
      .attach("image", pngBuffer(), { filename: "me.png", contentType: "image/png" });
    expect(ok.status).toBe(200);
    expect((await User.findById(customer.user.id)).avatar).toMatch(/^https:\/\/ik\.test\//);

    const fake = await api()
      .patch("/api/upload/avatar")
      .set(auth(customer.token))
      .attach("image", Buffer.from("not an image"), { filename: "x.png", contentType: "image/png" });
    expect(fake.status).toBe(400);

    const big = await api()
      .patch("/api/upload/avatar")
      .set(auth(customer.token))
      .attach("image", pngBuffer(1024 * 1024 + 10), { filename: "big.png", contentType: "image/png" });
    expect(big.status).toBe(400);
  });

  it("providers by category, get-me, and marking one notification read", async () => {
    const provider = await createApprovedProvider({ admin, category, name: "By category" });
    const byCat = await api().get(`/api/provider/category/${category._id}`);
    expect(byCat.status).toBe(200);
    expect(byCat.body.providers.map((p) => String(p._id))).toContain(provider.providerId);

    const me = await api().get("/api/auth/get-me").set(auth(provider.token));
    expect(me.body.data.role).toBe("provider");
    expect(me.body.data.providerProfile._id).toBe(provider.providerId);

    const customer = await createCustomer();
    await book(customer, provider.providerId);
    const notes = await api().get("/api/notifications").set(auth(provider.token));
    const note = notes.body.notifications.find((n) => !n.isRead);
    const read = await api().patch(`/api/notifications/${note._id}/read`).set(auth(provider.token));
    expect(read.status).toBe(200);
    // Someone else's notification cannot be touched
    expect((await api().patch(`/api/notifications/${note._id}/read`).set(auth(customer.token))).status).toBe(404);
  });
});

describe("Production setup", () => {
  it("trusts the host's proxy, so rate limits see the real visitor IP", () => {
    expect(app.get("trust proxy")).toBe(1);
  });

  it("sends a Content Security Policy that allows ImageKit images", async () => {
    const res = await api().get("/api/health");
    expect(res.headers["content-security-policy"]).toMatch(/img-src 'self' data: blob: https:\/\/ik\.imagekit\.io/);
  });

  it("unknown /api routes stay JSON 404s even when the React app is served", async () => {
    const res = await api().get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
