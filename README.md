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

**Posts** (photos of a provider's work)
- 1–4 images per post, **each under 1 MB**, JPG, PNG or WEBP only.
- The real file type is checked from the file's bytes, so a renamed text file is rejected. Images are uploaded to ImageKit.
- When a provider posts about their own work it is a `showcase` post. When a customer posts about a provider it is an `experience` post. It gets a **verified customer** badge if the customer had a completed booking with that provider.
- Likes are a toggle and stay correct when two requests arrive at the same time. Posts support comments.
- Users can report a post. After 5 reports it is hidden automatically until an admin reviews it.
- Deleting a post also deletes its images from ImageKit.

**Notifications**
- Sent for bookings, reviews, likes, comments, provider approval and moderation.
- Shows an unread count, and you can mark one or all as read. Old notifications are deleted automatically after 90 days.

**Admin**
- Approve or reject providers, and manage users and categories.
- See all bookings, moderate reports, and view a dashboard with booking stats and top providers.

**Redis**
- The category list is cached and cleared whenever a category changes. `/getusers` is a cached demo endpoint for admins only.
- The app still works if Redis is down; it just doesn't cache.

---

## Frontend (React)

`client/`: React 19 · Vite · Tailwind CSS v4 · React Router · Redux Toolkit · Axios

**Design:** dark and light themes with a switch (it follows the computer's setting the first time), one warm orange accent, a wide display headline font (Archivo) with Urbanist for text, frosted-glass navbar and popups, and cards with a round cut-out corner holding the action button (done with a CSS mask, so it works on any background). Every colour is a CSS variable, so the whole theme changes in one place.

- **Become a provider:** customers open **My profile** and tap **Become a provider**. The application form opens in a popup, and the card then shows "under review" until an admin decides.

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

There are 43 API tests. They run against an in-memory MongoDB replica set, ImageKit is faked, and your real database is never touched.

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
| POST | `/` | Private | **multipart**: providerId, text, images[] (1–4, < 1 MB each) |
| GET / PATCH / DELETE | `/:id` | Public / Author / Author+Admin | |
| POST | `/:id/like` | Private | Toggle |
| GET / POST | `/:id/comments` | Public / Private | |
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
