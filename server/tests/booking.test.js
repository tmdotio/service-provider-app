import { beforeAll, describe, expect, it } from "vitest";
import Booking from "../src/models/booking.model.js";
import ServiceProvider from "../src/models/serviceProvider.model.js";
import {
  api,
  auth,
  createAdmin,
  createApprovedProvider,
  createCategory,
  createCustomer,
} from "./helpers.js";

let admin;
let category;

beforeAll(async () => {
  admin = await createAdmin();
  category = await createCategory("Electrician");
});

const book = (customer, providerId, cat = category) =>
  api()
    .post(`/api/booking/${providerId}`)
    .set(auth(customer.token))
    .send({
      category: String(cat._id),
      description: "Fan is not working, please fix it",
      serviceAddress: "House 12, Johar Town, Lahore",
    });

const respond = (provider, bookingId, action, reason) =>
  api()
    .patch(`/api/booking/${bookingId}/respond`)
    .set(auth(provider.token))
    .send({ action, reason });

const providerStatus = async (providerId) =>
  (await ServiceProvider.findById(providerId)).availabilityStatus;

describe("Booking flow", () => {
  it("pending -> accepted (busy) -> completed (available, completedJobs +1)", async () => {
    const provider = await createApprovedProvider({ admin, category });
    const customer = await createCustomer();

    const created = await book(customer, provider.providerId);
    expect(created.status).toBe(201);
    expect(created.body.booking.status).toBe("pending");
    const bookingId = created.body.booking._id;

    const accepted = await respond(provider, bookingId, "accept");
    expect(accepted.status).toBe(200);
    expect(accepted.body.booking.status).toBe("in_progress");
    expect(accepted.body.booking.acceptedAt).toBeTruthy();
    expect(await providerStatus(provider.providerId)).toBe("busy");

    // While busy, nobody else can book this provider
    const other = await createCustomer();
    expect((await book(other, provider.providerId)).status).toBe(404);

    const completed = await api()
      .patch(`/api/booking/${bookingId}/complete`)
      .set(auth(provider.token));
    expect(completed.status).toBe(200);
    expect(completed.body.booking.status).toBe("completed");

    const profile = await ServiceProvider.findById(provider.providerId);
    expect(profile.availabilityStatus).toBe("available");
    expect(profile.completedJobs).toBe(1);

    // Customer got notifications
    const notes = await api().get("/api/notifications").set(auth(customer.token));
    const types = notes.body.notifications.map((n) => n.type);
    expect(types).toEqual(
      expect.arrayContaining(["booking_accepted", "booking_completed"]),
    );
  });

  it("cannot book an offline provider or a category they don't offer", async () => {
    const offline = await createApprovedProvider({ admin, category, available: false });
    const customer = await createCustomer();
    expect((await book(customer, offline.providerId)).status).toBe(404);

    const online = await createApprovedProvider({ admin, category });
    const otherCategory = await createCategory("Painter");
    expect((await book(customer, online.providerId, otherCategory)).status).toBe(404);
  });

  it("validates booking input", async () => {
    const provider = await createApprovedProvider({ admin, category });
    const customer = await createCustomer();
    const res = await api()
      .post(`/api/booking/${provider.providerId}`)
      .set(auth(customer.token))
      .send({ category: "bad", description: "short", serviceAddress: "" });
    expect(res.status).toBe(400);
  });

  it("customer cancels a pending booking", async () => {
    const provider = await createApprovedProvider({ admin, category });
    const customer = await createCustomer();
    const { body } = await book(customer, provider.providerId);

    const res = await api()
      .patch(`/api/booking/${body.booking._id}/cancel`)
      .set(auth(customer.token))
      .send({ reason: "Changed my plan" });

    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe("cancelled");
    expect(res.body.booking.cancelledBy).toBe("customer");
  });

  it("cancel needs a reason", async () => {
    const provider = await createApprovedProvider({ admin, category });
    const customer = await createCustomer();
    const { body } = await book(customer, provider.providerId);

    const res = await api()
      .patch(`/api/booking/${body.booking._id}/cancel`)
      .set(auth(customer.token))
      .send({});
    expect(res.status).toBe(400);
  });

  it("provider must reject (not cancel) a pending booking", async () => {
    const provider = await createApprovedProvider({ admin, category });
    const customer = await createCustomer();
    const { body } = await book(customer, provider.providerId);

    const res = await api()
      .patch(`/api/booking/${body.booking._id}/cancel`)
      .set(auth(provider.token))
      .send({ reason: "Too far" });
    expect(res.status).toBe(400);
  });

  it("provider cancels an in-progress job and becomes available again", async () => {
    const provider = await createApprovedProvider({ admin, category });
    const customer = await createCustomer();
    const { body } = await book(customer, provider.providerId);
    await respond(provider, body.booking._id, "accept");

    const res = await api()
      .patch(`/api/booking/${body.booking._id}/cancel`)
      .set(auth(provider.token))
      .send({ reason: "Family emergency" });

    expect(res.status).toBe(200);
    expect(res.body.booking.cancelledBy).toBe("provider");
    expect(await providerStatus(provider.providerId)).toBe("available");
  });

  it("no-show: not allowed before 1 hour, allowed after", async () => {
    const provider = await createApprovedProvider({ admin, category });
    const customer = await createCustomer();
    const { body } = await book(customer, provider.providerId);
    const bookingId = body.booking._id;
    await respond(provider, bookingId, "accept");

    const tooEarly = await api()
      .patch(`/api/booking/${bookingId}/no-show`)
      .set(auth(customer.token))
      .send({});
    expect(tooEarly.status).toBe(400);

    // Pretend the provider accepted 2 hours ago
    await Booking.updateOne(
      { _id: bookingId },
      { acceptedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    );

    const res = await api()
      .patch(`/api/booking/${bookingId}/no-show`)
      .set(auth(customer.token))
      .send({ reason: "Waited 2 hours" });

    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe("no_show");

    const profile = await ServiceProvider.findById(provider.providerId);
    expect(profile.noShowCount).toBe(1);
    expect(profile.availabilityStatus).toBe("available");
  });

  it("only the customer can report a no-show", async () => {
    const provider = await createApprovedProvider({ admin, category });
    const customer = await createCustomer();
    const { body } = await book(customer, provider.providerId);
    await respond(provider, body.booking._id, "accept");

    const res = await api()
      .patch(`/api/booking/${body.booking._id}/no-show`)
      .set(auth(provider.token))
      .send({});
    expect(res.status).toBe(403);
  });

  it("strangers cannot view a booking, participants and admin can", async () => {
    const provider = await createApprovedProvider({ admin, category });
    const customer = await createCustomer();
    const stranger = await createCustomer();
    const { body } = await book(customer, provider.providerId);
    const url = `/api/booking/${body.booking._id}`;

    expect((await api().get(url).set(auth(stranger.token))).status).toBe(403);
    expect((await api().get(url).set(auth(customer.token))).status).toBe(200);
    expect((await api().get(url).set(auth(provider.token))).status).toBe(200);
    expect((await api().get(url).set(auth(admin.token))).status).toBe(200);
  });
});

describe("Reviews", () => {
  it("review only after completion, once, and rating is recalculated", async () => {
    const provider = await createApprovedProvider({ admin, category });
    const c1 = await createCustomer();
    const c2 = await createCustomer();

    const finishJob = async (customer) => {
      const { body } = await book(customer, provider.providerId);
      await respond(provider, body.booking._id, "accept");
      return body.booking._id;
    };

    const b1 = await finishJob(c1);

    // Not completed yet
    const early = await api()
      .post(`/api/booking/${b1}/review`)
      .set(auth(c1.token))
      .send({ rating: 5 });
    expect(early.status).toBe(400);

    await api().patch(`/api/booking/${b1}/complete`).set(auth(provider.token));

    // Someone else cannot review it
    const stranger = await api()
      .post(`/api/booking/${b1}/review`)
      .set(auth(c2.token))
      .send({ rating: 1 });
    expect(stranger.status).toBe(403);

    const ok = await api()
      .post(`/api/booking/${b1}/review`)
      .set(auth(c1.token))
      .send({ rating: 5, comment: "Great work" });
    expect(ok.status).toBe(201);

    const again = await api()
      .post(`/api/booking/${b1}/review`)
      .set(auth(c1.token))
      .send({ rating: 4 });
    expect(again.status).toBe(409);

    const b2 = await finishJob(c2);
    await api().patch(`/api/booking/${b2}/complete`).set(auth(provider.token));
    await api()
      .post(`/api/booking/${b2}/review`)
      .set(auth(c2.token))
      .send({ rating: 2 });

    const profile = await ServiceProvider.findById(provider.providerId);
    expect(profile.averageRating).toBe(3.5);
    expect(profile.totalReviews).toBe(2);

    const list = await api().get(`/api/provider/${provider.providerId}/reviews`);
    expect(list.status).toBe(200);
    expect(list.body.breakdown).toMatchObject({ 5: 1, 2: 1 });

    // Provider replies to a review about them
    const reply = await api()
      .patch(`/api/reviews/${ok.body.review._id}/reply`)
      .set(auth(provider.token))
      .send({ text: "Thank you!" });
    expect(reply.status).toBe(200);
    expect(reply.body.review.providerReply.text).toBe("Thank you!");
  });

  it("rating must be 1-5", async () => {
    const res = await api()
      .post(`/api/booking/${"a".repeat(24)}/review`)
      .set(auth((await createCustomer()).token))
      .send({ rating: 9 });
    expect(res.status).toBe(400);
  });
});

describe("Robustness", () => {
  it("no-show and reject without a body do not crash", async () => {
    const admin2 = await createAdmin();
    const cat = await createCategory("Mason");
    const provider = await createApprovedProvider({ admin: admin2, category: cat });
    const customer = await createCustomer();
    const { body } = await api()
      .post(`/api/booking/${provider.providerId}`)
      .set(auth(customer.token))
      .send({
        category: String(cat._id),
        description: "Wall repair needed urgently",
        serviceAddress: "Model Town, Lahore",
      });

    const noShow = await api()
      .patch(`/api/booking/${body.booking._id}/no-show`)
      .set(auth(customer.token));
    expect(noShow.status).toBe(400); // still pending, not a 500

    const reject = await api()
      .patch(`/api/booking/${body.booking._id}/respond`)
      .set(auth(provider.token));
    expect(reject.status).toBe(400); // missing action, not a 500
  });
});
