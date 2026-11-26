import { createServer } from "node:http";
import { io as connect } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import Conversation from "../src/models/conversation.model.js";
import Message from "../src/models/message.model.js";
import { cleanUpChats } from "../src/services/chat.service.js";
import { setIO } from "../src/socket/emitter.js";
import { initSocket } from "../src/socket/index.js";
import {
  api,
  auth,
  createAdmin,
  createApprovedProvider,
  createCategory,
  createCustomer,
} from "./helpers.js";

let category;
let provider;
let customer;
let stranger;
let bookingId;
let httpServer;
let url;
const sockets = [];

const book = (who, providerId) =>
  api()
    .post(`/api/booking/${providerId}`)
    .set(auth(who.token))
    .send({
      category: String(category._id),
      description: "AC is leaking water, please check",
      serviceAddress: "House 4, Gulberg, Lahore",
    });

const openChat = (who, id = bookingId) => api().post("/api/chats").set(auth(who.token)).send({ bookingId: id });

/** Connect a real Socket.IO client and wait until it is in. */
const socketFor = (who) =>
  new Promise((resolve, reject) => {
    const s = connect(url, { auth: { token: who.token }, transports: ["websocket"], forceNew: true });
    sockets.push(s);
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
  });

const once = (s, event) => new Promise((resolve) => s.once(event, resolve));
const emit = (s, event, data) => new Promise((resolve) => s.emit(event, data, resolve));

beforeAll(async () => {
  const admin = await createAdmin();
  category = await createCategory("AC Technician");
  provider = await createApprovedProvider({ admin, category, name: "Imran" });
  customer = await createCustomer("Sana");
  stranger = await createCustomer("Stranger");

  const created = await book(customer, provider.providerId);
  bookingId = created.body.booking._id;

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

describe("Chat", () => {
  it("only people with a booking together can open a chat, and it is reused", async () => {
    const first = await openChat(customer);
    expect(first.status).toBe(200);
    expect(first.body.conversation.other.businessName).toBe("Imran Services");

    // The provider opening the same booking gets the same conversation
    const fromProvider = await openChat(provider);
    expect(fromProvider.body.conversation._id).toBe(first.body.conversation._id);
    expect(fromProvider.body.conversation.other.name).toBe("Sana");

    expect((await openChat(stranger)).status).toBe(403);
    expect((await openChat(customer, "not-an-id")).status).toBe(400);
  });

  it("REST: send, list, unread count, mark read, and outsiders are kept out", async () => {
    const { body } = await openChat(customer);
    const id = body.conversation._id;

    const sent = await api().post(`/api/chats/${id}/messages`).set(auth(customer.token)).send({ text: "  Salam, kab aa sakte hain?  " });
    expect(sent.status).toBe(201);
    expect(sent.body.message.text).toBe("Salam, kab aa sakte hain?");

    expect((await api().post(`/api/chats/${id}/messages`).set(auth(customer.token)).send({ text: "   " })).status).toBe(400);
    expect((await api().post(`/api/chats/${id}/messages`).set(auth(customer.token)).send({ text: "x".repeat(1001) })).status).toBe(400);

    // A stranger cannot read or write (and is not told the chat exists)
    expect((await api().get(`/api/chats/${id}/messages`).set(auth(stranger.token))).status).toBe(404);
    expect((await api().post(`/api/chats/${id}/messages`).set(auth(stranger.token)).send({ text: "hi" })).status).toBe(404);

    const unread = await api().get("/api/chats/unread-count").set(auth(provider.token));
    expect(unread.body.unreadCount).toBe(1);

    const list = await api().get("/api/chats").set(auth(provider.token));
    expect(list.body.conversations[0].lastMessage.text).toBe("Salam, kab aa sakte hain?");
    expect(list.body.conversations[0].unread).toBe(1);

    await api().patch(`/api/chats/${id}/read`).set(auth(provider.token));
    expect((await api().get("/api/chats/unread-count").set(auth(provider.token))).body.unreadCount).toBe(0);

    const msgs = await api().get(`/api/chats/${id}/messages`).set(auth(customer.token));
    expect(msgs.body.messages.at(-1).readAt).toBeTruthy();
  });

  it("loads older messages page by page", async () => {
    const { body } = await openChat(customer);
    const id = body.conversation._id;
    for (let i = 0; i < 5; i += 1) {
      await api().post(`/api/chats/${id}/messages`).set(auth(provider.token)).send({ text: `msg ${i}` });
    }
    const page1 = await api().get(`/api/chats/${id}/messages?limit=3`).set(auth(customer.token));
    expect(page1.body.messages.map((m) => m.text)).toEqual(["msg 2", "msg 3", "msg 4"]);
    expect(page1.body.hasMore).toBe(true);

    const before = page1.body.messages[0].createdAt;
    const page2 = await api().get(`/api/chats/${id}/messages?limit=3&before=${before}`).set(auth(customer.token));
    expect(page2.body.messages.at(-1).text).toBe("msg 1");
  });

  it("socket: rejects a connection without a valid token", async () => {
    await expect(socketFor({ token: "bad" })).rejects.toThrow("unauthorized");
  });

  it("socket: live message, typing and read receipt reach the other person", async () => {
    const { body } = await openChat(customer);
    const id = body.conversation._id;
    await api().patch(`/api/chats/${id}/read`).set(auth(customer.token)); // start from 0 unread
    const customerSocket = await socketFor(customer);
    const providerSocket = await socketFor(provider);

    const typing = once(providerSocket, "chat:typing");
    customerSocket.emit("chat:typing", { conversationId: id, typing: true });
    expect(await typing).toMatchObject({ conversationId: id, typing: true });

    const arrives = once(providerSocket, "chat:message");
    const echo = once(customerSocket, "chat:message");
    const ack = await emit(customerSocket, "chat:send", { conversationId: id, text: "Live hello" });
    expect(ack.ok).toBe(true);

    const got = await arrives;
    expect(got.message.text).toBe("Live hello");
    expect(got.conversation.unread).toBeGreaterThan(0);
    expect((await echo).conversation.unread).toBe(0);

    const receipt = once(customerSocket, "chat:read");
    expect((await emit(providerSocket, "chat:read", { conversationId: id })).ok).toBe(true);
    expect(await receipt).toMatchObject({ conversationId: id });
  });

  it("socket: a stranger cannot send into someone else's chat", async () => {
    const { body } = await openChat(customer);
    const s = await socketFor(stranger);
    const ack = await emit(s, "chat:send", { conversationId: body.conversation._id, text: "spam" });
    expect(ack).toEqual({ ok: false, message: "Conversation not found" });
  });
});

describe("Live booking events", () => {
  it("both sides get booking:updated and the bell gets notification:new", async () => {
    const admin = await createAdmin();
    const p = await createApprovedProvider({ admin, category, name: "Live" });
    const c = await createCustomer("Live customer");
    const providerSocket = await socketFor(p);
    const customerSocket = await socketFor(c);

    const providerHears = once(providerSocket, "booking:updated");
    const bell = once(providerSocket, "notification:new");
    const created = await book(c, p.providerId);
    expect(await providerHears).toMatchObject({ bookingId: created.body.booking._id, status: "pending", side: "provider" });
    expect((await bell).type).toBe("booking_created");

    const customerHears = once(customerSocket, "booking:updated");
    await api().patch(`/api/booking/${created.body.booking._id}/respond`).set(auth(p.token)).send({ action: "accept" });
    expect(await customerHears).toMatchObject({ status: "in_progress", side: "customer" });

    const providerHearsCancel = once(providerSocket, "booking:updated");
    await api().patch(`/api/booking/${created.body.booking._id}/cancel`).set(auth(c.token)).send({ reason: "Not needed now" });
    expect(await providerHearsCancel).toMatchObject({ status: "cancelled", side: "provider" });
  });
});

describe("Chat belongs to one booking", () => {
  const setup = async () => {
    const admin = await createAdmin();
    const p = await createApprovedProvider({ admin, category, name: "Per booking" });
    const c = await createCustomer("Per booking customer");
    const created = await book(c, p.providerId);
    return { p, c, bookingId: created.body.booking._id };
  };

  it("each booking gets its own chat", async () => {
    const { p, c, bookingId } = await setup();
    const first = await openChat(c, bookingId);
    const second = await book(c, p.providerId);
    const other = await openChat(c, second.body.booking._id);
    expect(other.status).toBe(200);
    expect(other.body.conversation._id).not.toBe(first.body.conversation._id);
  });

  it("completing the job deletes the chat and every message, for both people", async () => {
    const { p, c, bookingId } = await setup();
    const { body } = await openChat(c, bookingId);
    const id = body.conversation._id;
    await api().post(`/api/chats/${id}/messages`).set(auth(c.token)).send({ text: "Ghar ka address bhej raha hoon" });
    await api().post(`/api/chats/${id}/messages`).set(auth(p.token)).send({ text: "Theek hai" });
    expect(await Message.countDocuments({ conversation: id })).toBe(2);

    const customerSocket = await socketFor(c);
    const closed = once(customerSocket, "chat:closed");
    await api().patch(`/api/booking/${bookingId}/respond`).set(auth(p.token)).send({ action: "accept" });
    expect(await Message.countDocuments({ conversation: id })).toBe(2); // still open while in progress
    await api().patch(`/api/booking/${bookingId}/complete`).set(auth(p.token));

    expect(await closed).toMatchObject({ conversationId: id, status: "completed" });
    expect(await Message.countDocuments({ conversation: id })).toBe(0);
    expect(await Conversation.exists({ _id: id })).toBeNull();
    expect((await api().get(`/api/chats/${id}/messages`).set(auth(c.token))).status).toBe(404);
    expect((await api().get("/api/chats").set(auth(p.token))).body.conversations.map((x) => x._id)).not.toContain(id);

    // The chat of a finished booking cannot be opened again...
    expect((await openChat(c, bookingId)).status).toBe(410);
    // ...but a new booking starts a fresh, empty chat
    const again = await book(c, p.providerId);
    const fresh = await openChat(c, again.body.booking._id);
    expect(fresh.status).toBe(200);
    const msgs = await api().get(`/api/chats/${fresh.body.conversation._id}/messages`).set(auth(c.token));
    expect(msgs.body.messages).toEqual([]);
  });

  it("rejected and cancelled bookings delete their chat too", async () => {
    const { p, c, bookingId } = await setup();
    const { body } = await openChat(c, bookingId);
    await api().patch(`/api/booking/${bookingId}/respond`).set(auth(p.token)).send({ action: "reject", reason: "Fully booked" });
    expect(await Conversation.exists({ _id: body.conversation._id })).toBeNull();

    const next = await book(c, p.providerId);
    const chat = await openChat(c, next.body.booking._id);
    await api().patch(`/api/booking/${next.body.booking._id}/cancel`).set(auth(c.token)).send({ reason: "Changed my mind" });
    expect(await Conversation.exists({ _id: chat.body.conversation._id })).toBeNull();
  });

  it("chat responses are never cached, and outsiders see nothing", async () => {
    const { c, bookingId } = await setup();
    const { body } = await openChat(c, bookingId);
    const res = await api().get(`/api/chats/${body.conversation._id}/messages`).set(auth(c.token));
    expect(res.headers["cache-control"]).toMatch(/no-store/);

    const outsider = await createCustomer("Outsider");
    expect((await api().get(`/api/chats/${body.conversation._id}`).set(auth(outsider.token))).status).toBe(404);
    expect((await api().get("/api/chats").set(auth(outsider.token))).body.conversations).toEqual([]);
  });

  it("startup clean-up removes chats whose booking already ended", async () => {
    const { p, c, bookingId } = await setup();
    const { body } = await openChat(c, bookingId);
    await api().post(`/api/chats/${body.conversation._id}/messages`).set(auth(c.token)).send({ text: "hi" });
    // Simulate an old database: the booking ended but the chat stayed
    const Booking = (await import("../src/models/booking.model.js")).default;
    await Booking.updateOne({ _id: bookingId }, { status: "completed" });

    expect(await cleanUpChats()).toBeGreaterThanOrEqual(1);
    expect(await Conversation.exists({ _id: body.conversation._id })).toBeNull();
    expect(await Message.countDocuments({ conversation: body.conversation._id })).toBe(0);
    expect(p).toBeTruthy();
  });
});
