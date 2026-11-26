/**
 * Seed the database with the first admin and some categories.
 *
 *   npm run seed
 *
 * Reads ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD from .env.
 * Safe to run many times: it skips what already exists.
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import Category from "../src/models/category.model.js";
import User from "../src/models/user.model.js";

const CATEGORIES = [
  "Plumber",
  "Electrician",
  "AC Technician",
  "Carpenter",
  "Painter",
  "Cleaner",
  "Mechanic",
  "Tutor",
  "Beautician",
  "Gardener",
];

const run = async () => {
  const { MONGO_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!MONGO_URI) throw new Error("MONGO_URI is missing in .env");
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first");
  }
  if (ADMIN_PASSWORD.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters");
  }

  await mongoose.connect(MONGO_URI);

  const email = ADMIN_EMAIL.toLowerCase().trim();
  const existingAdmin = await User.findOne({ email });

  if (existingAdmin) {
    console.log(`Admin ${email} already exists (role: ${existingAdmin.role})`);
  } else {
    await User.create({
      name: ADMIN_NAME || "Admin",
      email,
      password: await bcrypt.hash(ADMIN_PASSWORD, 10),
      role: "admin",
    });
    console.log(`Admin created: ${email}`);
  }

  let created = 0;
  for (const name of CATEGORIES) {
    const exists = await Category.exists({
      name: new RegExp(`^${name}$`, "i"),
    });
    if (!exists) {
      await Category.create({ name });
      created += 1;
    }
  }
  console.log(`Categories created: ${created} (total ${await Category.countDocuments()})`);

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Seed failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
