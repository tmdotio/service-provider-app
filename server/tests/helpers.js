import bcrypt from "bcrypt";
import request from "supertest";
import app from "../src/app.js";
import Category from "../src/models/category.model.js";
import User from "../src/models/user.model.js";

export const api = () => request(app);

let userCounter = 0;

/** Register a customer through the API and return { token, user }. */
export const createCustomer = async (name = "Customer") => {
  userCounter += 1;
  const res = await api()
    .post("/api/auth/register")
    .send({
      name,
      email: `user${userCounter}_${Date.now()}@test.com`,
      password: "password123",
    });
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return { token: res.body.accessToken, user: res.body.user };
};

/** Create an admin directly in the DB and log in. */
export const createAdmin = async () => {
  userCounter += 1;
  const email = `admin${userCounter}@test.com`;
  await User.create({
    name: "Admin",
    email,
    password: await bcrypt.hash("password123", 10),
    role: "admin",
  });
  const res = await api()
    .post("/api/auth/login")
    .send({ email, password: "password123" });
  return { token: res.body.accessToken, user: res.body.user };
};

export const createCategory = (name = `Plumber ${Date.now()}${Math.random()}`) =>
  Category.create({ name });

/**
 * Customer -> applies -> admin approves -> provider.
 * Returns { token, user, providerId }.
 */
export const createApprovedProvider = async ({
  admin,
  category,
  city = "Lahore",
  available = true,
  name = "Provider",
}) => {
  const { token, user } = await createCustomer(name);

  const apply = await api()
    .post("/api/provider/become-provider")
    .set("Authorization", `Bearer ${token}`)
    .send({
      businessName: `${name} Services`,
      businessPhone: "03001234567",
      description: "Expert work at fair prices",
      experienceYears: 5,
      categories: [String(category._id)],
      location: { city, province: "Punjab", country: "Pakistan" },
    });
  if (apply.status !== 201) throw new Error(JSON.stringify(apply.body));

  const approve = await api()
    .patch(`/api/admin/provider-requests/${user.id}/review`)
    .set("Authorization", `Bearer ${admin.token}`)
    .send({ action: "approve" });
  if (approve.status !== 200) throw new Error(JSON.stringify(approve.body));

  if (available) {
    await api()
      .patch("/api/provider/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({ availabilityStatus: "available" });
  }

  return { token, user, providerId: apply.body.provider._id };
};

/** Small valid PNG-looking buffer (correct "magic bytes"). */
export const pngBuffer = (size = 200) => {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([header, Buffer.alloc(size)]);
};

export const auth = (token) => ({ Authorization: `Bearer ${token}` });
