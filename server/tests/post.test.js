import { beforeAll, describe, expect, it } from "vitest";
import Post from "../src/models/post.model.js";
import { deleteImages, uploadImages } from "../src/services/imageStorage.service.js";
import {
  api,
  auth,
  createAdmin,
  createApprovedProvider,
  createCategory,
  createCustomer,
  pngBuffer,
} from "./helpers.js";

let admin;
let provider;
let customer;

beforeAll(async () => {
  admin = await createAdmin();
  const category = await createCategory("Carpenter");
  provider = await createApprovedProvider({ admin, category });
  customer = await createCustomer("Ayesha");
});

const createPost = (user, { images = 1, text = "Very neat work, on time!" } = {}) => {
  const req = api()
    .post("/api/posts")
    .set(auth(user.token))
    .field("providerId", provider.providerId)
    .field("text", text);
  for (let i = 0; i < images; i += 1) {
    req.attach("images", pngBuffer(), { filename: `photo${i}.png`, contentType: "image/png" });
  }
  return req;
};

describe("Posts", () => {
  it("provider creates a showcase post, customer creates an experience post", async () => {
    const showcase = await createPost(provider, { images: 2, text: "Kitchen cabinets I made" });
    expect(showcase.status).toBe(201);
    expect(showcase.body.post.type).toBe("showcase");
    expect(showcase.body.post.images).toHaveLength(2);
    expect(showcase.body.post.likes).toBeUndefined();

    const experience = await createPost(customer);
    expect(experience.status).toBe(201);
    expect(experience.body.post.type).toBe("experience");
    expect(experience.body.post.isVerifiedCustomer).toBe(false);
  });

  it("needs at least one image", async () => {
    const res = await createPost(customer, { images: 0 });
    expect(res.status).toBe(400);
  });

  it("rejects images larger than 1 MB", async () => {
    const res = await api()
      .post("/api/posts")
      .set(auth(customer.token))
      .field("providerId", provider.providerId)
      .field("text", "Too big image")
      .attach("images", pngBuffer(1024 * 1024 + 10), {
        filename: "big.png",
        contentType: "image/png",
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/1 MB/);
  });

  it("rejects more than 4 images", async () => {
    const res = await createPost(customer, { images: 5 });
    expect(res.status).toBe(400);
  });

  it("rejects a fake image (text file renamed to .png)", async () => {
    const res = await api()
      .post("/api/posts")
      .set(auth(customer.token))
      .field("providerId", provider.providerId)
      .field("text", "Sneaky")
      .attach("images", Buffer.from("this is not an image at all"), {
        filename: "evil.png",
        contentType: "image/png",
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not a valid image/);
  });

  it("does not upload anything when validation fails", async () => {
    uploadImages.mockClear();
    const res = await createPost(customer, { text: "" });
    expect(res.status).toBe(400);
    expect(uploadImages).not.toHaveBeenCalled();
  });

  it("like toggles and counts correctly", async () => {
    const { body } = await createPost(provider);
    const url = `/api/posts/${body.post._id}/like`;

    const like = await api().post(url).set(auth(customer.token));
    expect(like.body).toMatchObject({ liked: true, likesCount: 1 });

    const unlike = await api().post(url).set(auth(customer.token));
    expect(unlike.body).toMatchObject({ liked: false, likesCount: 0 });

    await api().post(url).set(auth(customer.token));
    const feed = await api()
      .get(`/api/posts?provider=${provider.providerId}`)
      .set(auth(customer.token));
    const post = feed.body.posts.find((p) => p._id === body.post._id);
    expect(post.likedByMe).toBe(true);
    expect(post.likesCount).toBe(1);
  });

  it("comments: add, list, and only allowed users can delete", async () => {
    const { body } = await createPost(provider);
    const postId = body.post._id;

    const added = await api()
      .post(`/api/posts/${postId}/comments`)
      .set(auth(customer.token))
      .send({ text: "Looks great!" });
    expect(added.status).toBe(201);

    const list = await api().get(`/api/posts/${postId}/comments`);
    expect(list.body.comments).toHaveLength(1);

    const stranger = await createCustomer();
    const denied = await api()
      .delete(`/api/posts/${postId}/comments/${added.body.comment._id}`)
      .set(auth(stranger.token));
    expect(denied.status).toBe(403);

    // Post author can delete comments on their post
    const ok = await api()
      .delete(`/api/posts/${postId}/comments/${added.body.comment._id}`)
      .set(auth(provider.token));
    expect(ok.status).toBe(200);
    expect((await Post.findById(postId)).commentsCount).toBe(0);
  });

  it("only the author or admin can edit/delete; delete removes images", async () => {
    const { body } = await createPost(customer);
    const postId = body.post._id;

    const edit = await api()
      .patch(`/api/posts/${postId}`)
      .set(auth(provider.token))
      .send({ text: "hacked" });
    expect(edit.status).toBe(403);

    deleteImages.mockClear();
    const del = await api().delete(`/api/posts/${postId}`).set(auth(admin.token));
    expect(del.status).toBe(200);
    expect(deleteImages).toHaveBeenCalledTimes(1);
    expect(await Post.findById(postId)).toBeNull();
  });

  it("report: once per user, hidden after 5 reports, admin can remove", async () => {
    const { body } = await createPost(customer);
    const postId = body.post._id;

    const ownReport = await api()
      .post(`/api/posts/${postId}/report`)
      .set(auth(customer.token))
      .send({ reason: "spam" });
    expect(ownReport.status).toBe(400);

    const reporters = [];
    for (let i = 0; i < 5; i += 1) reporters.push(await createCustomer());

    const first = await api()
      .post(`/api/posts/${postId}/report`)
      .set(auth(reporters[0].token))
      .send({ reason: "fake" });
    expect(first.status).toBe(201);

    const duplicate = await api()
      .post(`/api/posts/${postId}/report`)
      .set(auth(reporters[0].token))
      .send({ reason: "fake" });
    expect(duplicate.status).toBe(409);

    for (const r of reporters.slice(1)) {
      await api()
        .post(`/api/posts/${postId}/report`)
        .set(auth(r.token))
        .send({ reason: "abusive" });
    }

    expect((await Post.findById(postId)).isHidden).toBe(true);
    expect((await api().get(`/api/posts/${postId}`)).status).toBe(404);

    const reports = await api().get("/api/admin/reports").set(auth(admin.token));
    const entry = reports.body.reports.find((r) => String(r._id) === postId);
    expect(entry.reportsCount).toBe(5);

    // Admin decides the reports were wrong -> visible again
    const dismiss = await api()
      .patch(`/api/admin/reports/${postId}`)
      .set(auth(admin.token))
      .send({ action: "dismiss" });
    expect(dismiss.status).toBe(200);
    expect((await Post.findById(postId)).isHidden).toBe(false);
  });

  it("guests can read the feed but not post", async () => {
    expect((await api().get("/api/posts")).status).toBe(200);
    expect((await api().post("/api/posts")).status).toBe(401);
  });
});
