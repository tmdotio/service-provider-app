import { describe, expect, it } from "vitest";
import User from "../src/models/user.model.js";
import { api, auth, createCustomer } from "./helpers.js";

const getCookie = (res) =>
  res.headers["set-cookie"].find((c) => c.startsWith("refresh-token="));

describe("Auth", () => {
  it("registers everyone as a customer, even if role=provider is sent", async () => {
    const res = await api().post("/api/auth/register").send({
      name: "Ali",
      email: "ali@test.com",
      password: "password123",
      role: "provider",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("customer");
    expect(res.body.accessToken).toBeTruthy();
  });

  it("rejects a duplicate email", async () => {
    const body = { name: "Sara", email: "sara@test.com", password: "password123" };
    await api().post("/api/auth/register").send(body);
    const res = await api().post("/api/auth/register").send(body);
    expect(res.status).toBe(400);
  });

  it("rejects invalid input with field errors", async () => {
    const res = await api()
      .post("/api/auth/register")
      .send({ name: "A", email: "not-an-email", password: "123" });
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field)).toEqual(
      expect.arrayContaining(["name", "email", "password"]),
    );
  });

  it("refresh token works, rotates, and the old one stops working", async () => {
    await api().post("/api/auth/register").send({
      name: "Bilal",
      email: "bilal@test.com",
      password: "password123",
    });
    const login = await api()
      .post("/api/auth/login")
      .send({ email: "bilal@test.com", password: "password123" });
    expect(login.status).toBe(200);
    const oldCookie = getCookie(login);

    const refresh = await api()
      .post("/api/auth/refresh-token")
      .set("Cookie", oldCookie);
    expect(refresh.status).toBe(200);
    expect(refresh.body.accessToken).toBeTruthy();

    // Old cookie was rotated -> rejected
    const reuse = await api()
      .post("/api/auth/refresh-token")
      .set("Cookie", oldCookie);
    expect(reuse.status).toBe(401);
  });

  it("logout revokes the refresh token", async () => {
    await api().post("/api/auth/register").send({
      name: "Hina",
      email: "hina@test.com",
      password: "password123",
    });
    const login = await api()
      .post("/api/auth/login")
      .send({ email: "hina@test.com", password: "password123" });
    const cookie = getCookie(login);

    const logout = await api()
      .post("/api/auth/logout")
      .set(auth(login.body.accessToken));
    expect(logout.status).toBe(200);

    const refresh = await api().post("/api/auth/refresh-token").set("Cookie", cookie);
    expect(refresh.status).toBe(401);
  });

  it("blocks login for deactivated users", async () => {
    await api().post("/api/auth/register").send({
      name: "Usman",
      email: "usman@test.com",
      password: "password123",
    });
    await User.updateOne({ email: "usman@test.com" }, { isActive: false });

    const res = await api()
      .post("/api/auth/login")
      .send({ email: "usman@test.com", password: "password123" });
    expect(res.status).toBe(403);
  });

  it("any role can update their profile", async () => {
    const { token } = await createCustomer();
    const res = await api()
      .patch("/api/auth/update-profile")
      .set(auth(token))
      .send({ name: "New Name" });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe("New Name");
  });

  it("returns JSON 404 for unknown routes", async () => {
    const res = await api().get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
