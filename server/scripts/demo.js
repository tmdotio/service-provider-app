/**
 * Demo mode: run the API on a temporary in-memory MongoDB filled with
 * sample data. Nothing touches your real database, and everything is
 * deleted when you stop it.
 *
 *   npm run demo        (API on http://localhost:5051)
 *
 * Demo logins (password for all: demo12345):
 *   admin@demo.test · customer@demo.test · ahmed@demo.test (provider)
 */
import bcrypt from "bcrypt";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

process.env.MONGO_URI = replSet.getUri("ustaad-demo");
process.env.PORT = process.env.PORT || "5051";
process.env.NODE_ENV = "development";
// Don't share the real Redis cache with demo data
process.env.REDIS_URL = "redis://127.0.0.1:1";
process.env.ACCESS_TOKEN_SECRETE ||= "demo-access-secret";
process.env.REFRESH_TOKEN_SECRETE ||= "demo-refresh-secret";

const { default: mongoose } = await import("mongoose");
const { default: User } = await import("../src/models/user.model.js");
const { default: Category } = await import("../src/models/category.model.js");
const { default: ServiceProvider } = await import("../src/models/serviceProvider.model.js");
const { default: Booking } = await import("../src/models/booking.model.js");
const { default: Review } = await import("../src/models/review.model.js");
const { default: Post } = await import("../src/models/post.model.js");

await mongoose.connect(process.env.MONGO_URI);

const password = await bcrypt.hash("demo12345", 10);

const categories = await Category.insertMany(
  ["Plumber", "Electrician", "AC Technician", "Carpenter", "Painter", "Cleaner"].map((name) => ({ name })),
);
const cat = Object.fromEntries(categories.map((c) => [c.name, c._id]));

await User.create({ name: "Admin", email: "admin@demo.test", password, role: "admin" });
const customer = await User.create({
  name: "Ayesha Khan",
  email: "customer@demo.test",
  password,
  phone: "03001111111",
});
const customer2 = await User.create({ name: "Bilal Ahmed", email: "bilal@demo.test", password });

const providerData = [
  ["Ahmed Raza", "ahmed@demo.test", "Ahmed Electric Works", ["Electrician", "AC Technician"], "Lahore", 8, "Wiring, fan and AC repair. Same-day service in Johar Town, Model Town and DHA."],
  ["Imran Ali", "imran@demo.test", "Imran Plumbing Services", ["Plumber"], "Lahore", 12, "Leaks, geysers, bathroom fittings. 12 years of experience."],
  ["Kashif Mehmood", "kashif@demo.test", "Kashif Wood Craft", ["Carpenter"], "Lahore", 15, "Custom kitchen cabinets, doors and furniture repair."],
  ["Sana Tariq", "sana@demo.test", "Sparkle Home Cleaning", ["Cleaner"], "Karachi", 4, "Deep cleaning for homes and offices. Team of 5."],
  ["Usman Ghani", "usman@demo.test", "Usman Paint House", ["Painter"], "Islamabad", 10, "Interior and exterior painting, weather-shield, polish."],
];

const providers = [];
for (const [name, email, businessName, cats, city, years, description] of providerData) {
  const user = await User.create({ name, email, password, role: "provider", phone: "03002222222" });
  providers.push(
    await ServiceProvider.create({
      user: user._id,
      businessName,
      businessPhone: "03002222222",
      description,
      experienceYears: years,
      categories: cats.map((c) => cat[c]),
      location: { city, province: city === "Karachi" ? "Sindh" : city === "Islamabad" ? "Islamabad Capital Territory" : "Punjab", country: "Pakistan" },
      verificationStatus: "approved",
      availabilityStatus: "available",
    }),
  );
}

// A pending application for the admin to review
const applicant = await User.create({ name: "Naveed Iqbal", email: "naveed@demo.test", password });
await ServiceProvider.create({
  user: applicant._id,
  businessName: "Naveed Solar Solutions",
  businessPhone: "03003333333",
  description: "Solar panel installation and maintenance.",
  experienceYears: 3,
  categories: [cat.Electrician],
  location: { city: "Lahore", province: "Punjab", country: "Pakistan" },
});

// Finished jobs with reviews
const hour = 60 * 60 * 1000;
const reviews = [
  [providers[0], customer, 5, "Came on time and fixed the wiring quickly. Very professional."],
  [providers[0], customer2, 4, "Good work, slightly expensive."],
  [providers[1], customer, 5, "Fixed a leak nobody else could find!"],
  [providers[2], customer2, 5, "Beautiful cabinets, highly recommended."],
];
for (const [provider, user, rating, comment] of reviews) {
  const booking = await Booking.create({
    customer: user._id,
    provider: provider._id,
    category: provider.categories[0],
    description: "Demo job that was completed earlier",
    serviceAddress: "Johar Town, Lahore",
    status: "completed",
    acceptedAt: new Date(Date.now() - 50 * hour),
    completedAt: new Date(Date.now() - 48 * hour),
    isReviewed: true,
  });
  await Review.create({ booking: booking._id, customer: user._id, provider: provider._id, rating, comment });
  await ServiceProvider.updateOne({ _id: provider._id }, { $inc: { completedJobs: 1 } });
}
for (const p of providers) await Review.recalculateProviderRating(p._id);

// An accepted job, accepted 2 hours ago (so the customer can try "Provider didn't come")
await Booking.create({
  customer: customer._id,
  provider: providers[1]._id,
  category: cat.Plumber,
  description: "Kitchen sink is blocked and water is leaking under it",
  serviceAddress: "House 21, Block C, Model Town, Lahore",
  status: "in_progress",
  acceptedAt: new Date(Date.now() - 2 * hour),
});
await ServiceProvider.updateOne({ _id: providers[1]._id }, { availabilityStatus: "busy" });

// A pending request for the provider demo account (Ahmed)
await Booking.create({
  customer: customer2._id,
  provider: providers[0]._id,
  category: cat.Electrician,
  description: "Ceiling fan makes noise and runs slowly",
  serviceAddress: "Street 5, DHA Phase 4, Lahore",
});

// Posts with simple generated images (no real uploads in demo mode)
const svg = (text, color) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><rect width='100%' height='100%' fill='${color}'/><text x='50%' y='50%' font-family='sans-serif' font-size='48' fill='white' text-anchor='middle' dominant-baseline='middle'>${text}</text></svg>`,
  )}`;

const ahmedUser = await User.findOne({ email: "ahmed@demo.test" });
const kashifUser = await User.findOne({ email: "kashif@demo.test" });
await Post.create([
  {
    author: kashifUser._id,
    provider: providers[2]._id,
    type: "showcase",
    text: "Finished this kitchen in Bahria Town last week. Solid wood, soft-close hinges.",
    images: [
      { url: svg("Kitchen — before", "#9ca3af"), fileId: "demo1" },
      { url: svg("Kitchen — after", "#059669"), fileId: "demo2" },
    ],
  },
  {
    author: customer._id,
    provider: providers[0]._id,
    type: "experience",
    text: "Ahmed rewired our whole lounge in one day. Clean work and no mess left behind!",
    images: [{ url: svg("New wiring board", "#2563eb"), fileId: "demo3" }],
    isVerifiedCustomer: true,
    likes: [customer2._id],
    likesCount: 1,
  },
  {
    author: ahmedUser._id,
    provider: providers[0]._id,
    type: "showcase",
    text: "Split AC installed and gas refilled. Cooling like new.",
    images: [{ url: svg("AC installation", "#0891b2"), fileId: "demo4" }],
  },
]);

await mongoose.disconnect();

console.log("\nDemo data ready. Logins (password demo12345):");
console.log("  admin@demo.test · customer@demo.test · ahmed@demo.test (provider)\n");

// Start the real server against the demo database
await import("../server.js");

const stop = async () => {
  await replSet.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
