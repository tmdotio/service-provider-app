/** Add repeatable test accounts without changing existing users. Run: npm run seed:users */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import User from "../src/models/user.model.js";
import Category from "../src/models/category.model.js";
import ServiceProvider from "../src/models/serviceProvider.model.js";
import redisClient, { connectRedis } from "../src/config/redis.js";
import { CACHE_KEYS, clearCache, invalidateProviders } from "../src/services/cache.service.js";

const PASSWORD = "Test@12345";
const SERVICES = ["Plumber", "Electrician", "AC Technician", "Carpenter", "Painter", "Cleaner", "Mechanic", "Tutor", "Beautician", "Gardener"];
const NAMES = ["Ahmed", "Ayesha", "Bilal", "Fatima", "Hamza", "Hina", "Imran", "Iqra", "Kashif", "Maham", "Naveed", "Nida", "Omar", "Sana", "Usman", "Zainab", "Ali", "Maryam", "Hassan", "Sara"];
const SURNAMES = ["Khan", "Ali", "Ahmed", "Malik", "Raza"];
const LOCATIONS = [
  ["Karachi", "Sindh", "Gulshan-e-Iqbal"],
  ["Lahore", "Punjab", "Johar Town"],
  ["Islamabad", "Islamabad Capital Territory", "G-11"],
  ["Rawalpindi", "Punjab", "Satellite Town"],
  ["Faisalabad", "Punjab", "Madina Town"],
];
const accounts = [
  ...Array.from({ length: 30 }, (_, i) => ({ role: "customer", number: i + 1 })),
  ...Array.from({ length: 20 }, (_, i) => ({ role: "provider", number: i + 1 })),
].map((account, i) => ({
  ...account,
  name: `${NAMES[i % NAMES.length]} ${SURNAMES[Math.floor(i / NAMES.length)]}`,
  email: `${account.role}${String(account.number).padStart(2, "0")}@seed.example.test`,
  // Reserved fictional 202-555-01xx numbers; these are test contacts only.
  phone: `+1202555${String(100 + i).padStart(4, "0")}`,
}));

async function run() {
  if (process.env.NODE_ENV === "production") throw new Error("Test accounts cannot be seeded in production mode.");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing in .env");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });

  // Check the entire namespace before inserting anything. Never reset a password or role.
  const existing = await User.find({ email: { $in: accounts.map(a => a.email) } }).select("+password");
  for (const user of existing) {
    const account = accounts.find(a => a.email === user.email);
    if (user.role !== account.role || !user.isActive || !(await bcrypt.compare(PASSWORD, user.password))) {
      throw new Error(`Existing account ${user.email} differs from this seed; left unchanged.`);
    }
  }

  const categories = [];
  for (const name of SERVICES) {
    categories.push(await Category.findOne({ name: new RegExp(`^${name}$`, "i") }) || await Category.create({ name }));
  }

  let createdUsers = 0;
  let createdProviders = 0;
  const rows = [];
  for (const account of accounts) {
    let user = existing.find(u => u.email === account.email);
    if (!user) {
      user = await User.create({ name: account.name, email: account.email, phone: account.phone,
        role: account.role, password: await bcrypt.hash(PASSWORD, 10) });
      createdUsers++;
    }
    let provider;
    if (account.role === "provider") {
      const index = account.number - 1;
      const category = categories[index % categories.length];
      // Both providers in each category serve different cities.
      const [city, province, area] = LOCATIONS[(index + Math.floor(index / SERVICES.length)) % LOCATIONS.length];
      provider = await ServiceProvider.findOne({ user: user._id });
      if (!provider) {
        provider = await ServiceProvider.create({
          user: user._id,
          businessName: `${account.name} ${category.name} Services`,
          businessPhone: user.phone,
          description: `Sample ${category.name.toLowerCase()} provider in ${city} for app testing. Contact number is fictional.`,
          experienceYears: 2 + index % 14,
          categories: [category._id],
          location: { city, province, country: "Pakistan" },
          serviceAreas: [{ city, area }],
          verificationStatus: "approved",
          availabilityStatus: "available",
        });
        createdProviders++;
      }
    }
    rows.push(`| ${user.role} | ${user.name} | ${user.email} | ${PASSWORD} | ${user.phone} | ${provider?.location.city || "—"} |`);
  }

  await connectRedis();
  await invalidateProviders();
  await clearCache(CACHE_KEYS.categories, CACHE_KEYS.allUsers);

  const output = new URL("../generated/seed-accounts.md", import.meta.url);
  await mkdir(new URL("../generated/", import.meta.url), { recursive: true });
  await writeFile(output, `# Test account logins\n\n30 customers and 20 providers. Login uses email and password.\n\nPhone numbers are fictional test contacts, not real Pakistani numbers. No admin accounts are created. Existing accounts are preserved.\n\n| Role | Name | Email | Password | Phone | City |\n| --- | --- | --- | --- | --- | --- |\n${rows.join("\n")}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ createdUsers, createdProviders, totalSeedAccounts: accounts.length, credentialsFile: output.pathname }));
}

try {
  await run();
} catch (error) {
  console.error("User seed failed:", error.message);
  process.exitCode = 1;
} finally {
  if (redisClient.isOpen) await redisClient.close();
  await mongoose.disconnect();
}
