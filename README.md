# Ustaad — Service Provider App (MERN)

A local services marketplace API (plumbers, electricians, carpenters...). Customers find a provider, book them, and track the job. Afterwards they review the provider and post photos of the work. Admins approve providers and moderate posts.

**Stack:** Node.js · Express 5 · MongoDB (Mongoose 9, transactions) · Redis cache · JWT (access + rotating refresh tokens) · ImageKit · Multer · express-validator · Vitest + Supertest

---

## Features

**Auth**
- Register and login. Access token lasts 15 minutes. The refresh token sits in an httpOnly cookie, rotates on every refresh, and is revoked on logout.
- Login and register are rate-limited, and change-password is supported.
- Everyone registers as a customer. To become a provider you apply, and an admin approves.

**Providers**
- Search by category, city, province, rating, availability or text, with sorting and pagination.
- Public profile with the latest reviews and number of posts.
- Providers edit their own profile and go online or offline.
  `busy` is set automatically while a job is running.

**Bookings** (MongoDB transactions keep a booking and the provider's status in sync)

```
pending ──accept──▶ in_progress ──complete──▶ completed
   │                    │
   ├─reject─▶ rejected  ├─cancel (customer/provider)─▶ cancelled
   └─cancel (customer)─▶ cancelled
                        └─no-show (customer, 1h after accept)─▶ no_show
```

- When a provider accepts a job they become `busy`. Completing, cancelling or a no-show makes them `available` again.
- Completed jobs increase `completedJobs`. A no-show increases the provider's public `noShowCount`.

**Reviews**
- A customer can review a booking once, after it is completed or marked no-show. Ratings are 1–5 stars.
- The provider's average rating is recalculated with an aggregation, and a star breakdown is returned.
- Providers can reply to reviews.

**Posts** (a provider's own work)
- **Only providers post**, about their own jobs: up to 2 **before** and 2 **after** photos (at least 1 after), each **under 1 MB**, JPG/PNG/WEBP. The real file type is checked from the bytes. Photos go to ImageKit.
- **Customers comment** to ask questions; **only the provider who posted can reply** (one level), and the customer gets a notification.
- Likes (correct even with double clicks), reports (hidden after 5, then an admin reviews), and deleting a post removes its images from ImageKit.

**Provider banner**: providers upload a cover image (max 1 MB) for their public page; the old one is deleted from ImageKit.

**Customer → provider**: after approval the menu switches to provider sections, a setup checklist guides them (banner, go online, first post), and they keep the bookings they made as a customer (providers can also hire other providers, never themselves).

**Notifications**
- Sent for bookings, reviews, likes, comments, provider approval and moderation.
- Shows an unread count, and you can mark one or all as read. Old notifications are deleted automatically after 90 days.

**Admin**
- Approve or reject providers, and manage users and categories.
- See all bookings, moderate reports, and view a dashboard with booking stats and top providers.

**Redis**
- **Provider search results** (2 min) and **provider profiles** (5 min) are cached. The same filters in any order or letter case use the same key.
- **Instant invalidation with version keys:** every cached key contains a version (`providers:v7:...`). One middleware runs after any successful change (booking accepted, review, banner, approval, profile edit...) and increases the version with a single `INCR` *before* the response is sent. Old keys are never read again and expire by themselves, so there's no need to find and delete them.
- The category list is cached and cleared on change; `/getusers` is an admin-only cached demo.
- Cached: provider search, provider profiles, a provider's reviews, and categories. Every cached response has an **`X-Cache: HIT` / `MISS`** header (DevTools → Network) so you can see Redis working.
- Demo mode uses the Redis from `.env` too, under a fresh `demo:<time>:` key prefix, so it never mixes with real data.
- Everything falls back to MongoDB if Redis is down. `CACHE_PREFIX` keeps apps apart when they share one Redis.

---

## Frontend (React)

`client/`: React 19 · Vite · Tailwind CSS v4 · React Router · Redux Toolkit · Axios

**Design:** dark and light themes with a switch (it follows the computer's setting the first time), one warm orange accent, a wide display headline font (Archivo) with Urbanist for text, frosted-glass navbar and popups, and cards with a round cut-out corner holding the action button (done with a CSS mask, so it works on any background). Every colour is a CSS variable, so the whole theme changes in one place.

- **Become a provider:** customers open **My profile** and tap **Become a provider**. The application form opens in a popup, and the card then shows "under review" until an admin decides.
- **Mobile first:** app-style bottom tab bar with role-based sections, popups that slide up as bottom sheets, 16px inputs (no iPhone zoom), safe-area padding for notched phones.
- **Smooth scrolling** with Lenis (off when the system asks for reduced motion; popups pause it).
- **Fast images:** ImageKit resizes on the fly to the size shown (x2 for sharp screens, face-centred avatars), images fade in over a shimmer, and the profile banner/avatar load first.
- **Instant revisits (stale-while-revalidate):** the first visit shows a skeleton; coming back shows the saved data immediately while fresh data loads quietly in the background. Cleared on login/logout.
- **Skeleton loaders** in the same shape as the real content (cards with the notch, posts, profile, jobs), a loading line and staggered fade-in for search results, and a glowing light around the search bar while typing.

- **Customers:** search providers with filters (kept in the URL). Book a provider, cancel, report "provider didn't come" (it unlocks 1 hour after the provider accepts), and leave reviews. Share photos of the work.
- **Providers:** dashboard to go online or offline. Accept, reject, complete or cancel jobs (the customer's phone is shown once a job is accepted). Post photos of your work, reply to reviews, and edit your business profile.
- **Admins:** overview with stats, approve or reject providers, moderate reported posts, and manage categories, users and bookings.
- **Everyone:** notification bell (checks every 30 seconds), work feed with likes, comments and reports, and a profile photo upload (images are checked to be under 1 MB in the browser first).
- **Auth:** the access token is kept only in memory. An Axios interceptor refreshes it automatically using the httpOnly cookie, and many requests that fail at the same time share one refresh call. The session is restored after a page reload.

## Getting started

```bash
cd server
npm install
cp .env.example .env      # fill in MongoDB, JWT secrets, ImageKit, ADMIN_*
npm run seed              # creates the first admin + 10 categories
npm run dev               # http://localhost:5001
```

MongoDB must support transactions (MongoDB Atlas does; a local server must run as a replica set).

In a second terminal:

```bash
cd client
npm install
npm run dev               # http://localhost:5173 (calls /api on port 5001)
```

### Deploy on Render (one Web Service)

Express serves the API, the live chat (Socket.IO) and the built React app
from one URL, so login cookies and the chat work without extra setup.

1. Push this repository to GitHub, then on Render: **New → Web Service**.
2. Settings:
   - Root directory: *(leave empty — the repository root)*
   - Build command: `npm run build`
   - Start command: `npm start`
   - Node version comes from `engines` (20.19 or newer).
3. Environment variables:
   - `NODE_ENV=production` (secure cookies)
   - `MONGO_URI` — MongoDB Atlas; in Atlas → Network Access allow `0.0.0.0/0`
   - `ACCESS_TOKEN_SECRETE`, `REFRESH_TOKEN_SECRETE` — long random strings
   - `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`
   - `REDIS_URL` — optional (Render Key Value); the app works without it
   - `CLIENT_URL` — only if another site also calls this API
4. After the first deploy, create the admin once from the Render Shell:
   `cd server && npm run seed` (uses `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`).

Notes: the free plan sleeps after 15 minutes without visitors (the first
request then takes a while, and open chats reconnect by themselves).
`TRUST_PROXY` (default `1`) tells Express how many proxies sit in front of it.

### Live chat (Socket.IO)

A customer and a provider who have a booking together can message each other
one-on-one. Press **Message** on a booking card (customer: Bookings page,
provider: Workspace), or open the chat icon in the top bar.

- Messages arrive live, with a typing indicator, ✓ sent / ✓✓ seen ticks,
  an unread badge in the top bar and a popup when another chat gets a message.
- One conversation per customer + provider pair; every booking between them
  shares the same history.
- The Socket.IO server runs on the same port as the API. In development Vite
  forwards `/socket.io` to it. Set `VITE_SOCKET_URL` if the API lives on
  another domain.
- REST fallback: `GET/POST /api/chats`, `GET/POST /api/chats/:id/messages`,
  `PATCH /api/chats/:id/read`, `GET /api/chats/unread-count`.

### Persistent test accounts

To add persistent test users to the database configured in `server/.env`, run
`npm run seed:users` from `server`. This creates 30 customers and 20 approved,
available providers across 10 services and 5 cities. Login details and fictional
phone numbers are saved to `server/generated/seed-accounts.md` (excluded from Git).
Rerunning preserves existing users, passwords, and provider profiles. This command
does not create bookings or reviews and refuses to run in production mode.

### Demo mode (no setup needed)

```bash
cd server && npm run demo                                   # API on :5051 with sample data
cd client && VITE_PROXY_TARGET=http://localhost:5051 npm run dev
```

Demo mode runs on a temporary in-memory database filled with sample providers, bookings, reviews and posts. The logins are listed at the top of `server/scripts/demo.js`. Your real database is never touched.

### Tests

```bash
npm test
```

There are 52 API tests (including cache tests with an in-memory fake Redis). They run against an in-memory MongoDB replica set, ImageKit is faked, and your real database is never touched.

---

## API

Send `Authorization: Bearer <accessToken>` on private routes.

### Auth — `/api/auth`
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/register` | Public | name, email, password, phone? |
| POST | `/login` | Public | email, password |
| POST | `/refresh-token` | Cookie | Rotates refresh token |
| GET | `/get-me` | Private | Includes provider profile for providers |
| POST | `/logout` | Private | |
| PATCH | `/update-profile` | Private | name, phone, avatar |

### Providers — `/api/provider`
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/` | Public | `q, category, city, province, minRating, availability, sort=rating\|jobs\|newest\|experience, page, limit` |
| POST | `/become-provider` | Customer | businessName, businessPhone, description, experienceYears, categories[], location{city,province,country} |
| GET | `/application` | Private | My application status |
| GET / PATCH | `/me` | Provider | My profile / update it |
| PATCH | `/me/availability` | Provider | `available` \| `offline` |
| PATCH / DELETE | `/me/banner` | Provider | Banner image (multipart `image`, < 1 MB) |
| GET | `/category/:categoryId` | Public | Providers in a category |
| GET | `/:id` | Public | Public profile |
| GET | `/:id/reviews` | Public | Reviews + star breakdown |

### Categories — `/api/categories`
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/` | Public | All categories with provider counts (cached) |

### Bookings — `/api/booking`
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/:providerId` | Customer | category, description, serviceAddress |
| GET | `/customer` | Customer | My bookings |
| GET | `/provider` | Provider | Bookings I received |
| GET | `/:bookingId` | Participant / Admin | |
| PATCH | `/:bookingId/respond` | Provider | action: `accept` \| `reject`, reason? |
| PATCH | `/:bookingId/complete` | Provider | |
| PATCH | `/:bookingId/cancel` | Customer / Provider | reason |
| PATCH | `/:bookingId/no-show` | Customer | 1 hour after accept |
| POST | `/:bookingId/review` | Customer | rating 1–5, comment? |

### Reviews — `/api/reviews`
| Method | Path | Access | Notes |
|---|---|---|---|
| PATCH | `/:id` | Author | Edit rating/comment |
| DELETE | `/:id` | Author / Admin | |
| PATCH | `/:id/reply` | Provider | text |

### Posts — `/api/posts`
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/` | Public | `provider, author, type, page, limit` (+ `likedByMe` when logged in) |
| POST | `/` | Provider | **multipart**: text, before[] (0–2), after[] (1–2), each < 1 MB |
| GET / PATCH / DELETE | `/:id` | Public / Author / Author+Admin | |
| POST | `/:id/like` | Private | Toggle |
| GET / POST | `/:id/comments` | Public / Private | Comments with replies; `parentId` = reply (post's provider only) |
| DELETE | `/:id/comments/:commentId` | Comment author / Post author / Admin | |
| POST | `/:id/report` | Private | reason: spam\|fake\|abusive\|inappropriate\|other |

### Notifications — `/api/notifications`
| Method | Path | Access |
|---|---|---|
| GET | `/?unread=true` | Private |
| PATCH | `/read-all` | Private |
| PATCH | `/:id/read` | Private |

### Upload — `/api/upload`
| Method | Path | Access | Notes |
|---|---|---|---|
| PATCH | `/avatar` | Private | multipart field `image`, < 1 MB |

### Admin — `/api/admin` (admin only)
`GET /dashboard-stats` · `GET /users` · `GET/PATCH/DELETE /users/:id` · `PATCH /users/:id/status` · `GET /providers` · `GET /providers/:id` · `PATCH /providers/:userId` · `GET /provider-requests/pending` · `PATCH /provider-requests/:id/review` · `POST/PATCH/DELETE /categories` · `GET /bookings?status=` · `GET /reports` · `PATCH /reports/:postId` (action: remove | dismiss)

---

## Error format

Every error has the same shape:

```json
{ "success": false, "message": "Validation failed", "errors": [{ "field": "email", "message": "Please provide a valid email" }] }
```

## Project structure

```
server/
  server.js            start: connect MongoDB + Redis, listen
  src/app.js           middleware + routes + error handler
  src/config/          db, redis, imagekit, jwt helpers
  src/models/          User, ServiceProvider, Category, Booking, Review, Post, Comment, Notification, Report
  src/controllers/     request handlers
  src/router/          routes
  src/middlewares/     auth, roles, upload (1 MB), errors, ObjectId check
  src/services/        cache (Redis), image storage (ImageKit), notifications
  src/validator/       express-validator rules
  scripts/seed.js      first admin + categories
  tests/               Vitest + Supertest
```
