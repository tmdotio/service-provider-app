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

const png = (name) => [pngBuffer(), { filename: name, contentType: "image/png" }];

/** Build a post request. before/after = number of images. */
const createPost = (user, { before = 0, after = 1, text = "Kitchen cabinets, finished today" } = {}) => {
  const req = api().post("/api/posts").set(auth(user.token)).field("text", text);
  for (let i = 0; i < before; i += 1) req.attach("before", ...png(`before${i}.png`));
  for (let i = 0; i < after; i += 1) req.attach("after", ...png(`after${i}.png`));
  return req;
};

describe("Posts", () => {
  it("provider posts their work with before/after photos", async () => {
    const res = await createPost(provider, { before: 1, after: 2 });
    expect(res.status).toBe(201);
    expect(res.body.post.provider._id).toBe(provider.providerId);
    expect(res.body.post.images.map((i) => i.label)).toEqual(["before", "after", "after"]);
    expect(res.body.post.provider.user.name).toBeTruthy();
    expect(res.body.post.likes).toBeUndefined();
  });

  it("customers cannot post (they comment instead)", async () => {
    uploadImages.mockClear();
    const res = await createPost(customer);
    expect(res.status).toBe(403);
    expect(uploadImages).not.toHaveBeenCalled();
  });

  it("needs at least one after photo", async () => {
    const res = await createPost(provider, { before: 1, after: 0 });
    expect(res.status).toBe(400);
  });

  it("rejects images larger than 1 MB", async () => {
    const res = await api()
      .post("/api/posts")
      .set(auth(provider.token))
      .field("text", "Too big image")
      .attach("after", pngBuffer(1024 * 1024 + 10), { filename: "big.png", contentType: "image/png" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/1 MB/);
  });

  it("rejects more than 2 photos per side", async () => {
    const res = await createPost(provider, { after: 3 });
    expect(res.status).toBe(400);
  });

  it("rejects a fake image (text file renamed to .png)", async () => {
    const res = await api()
      .post("/api/posts")
      .set(auth(provider.token))
      .field("text", "Sneaky")
      .attach("after", Buffer.from("this is not an image at all"), {
        filename: "evil.png",
        contentType: "image/png",
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not a valid image/);
  });

  it("does not upload anything when validation fails", async () => {
    uploadImages.mockClear();
    const res = await createPost(provider, { text: "" });
    expect(res.status).toBe(400);
    expect(uploadImages).not.toHaveBeenCalled();
  });

  it("customer comments, only the post's provider can reply, and the customer is notified", async () => {
    const { body } = await createPost(provider);
    const postId = body.post._id;

    const comment = await api()
      .post(`/api/posts/${postId}/comments`)
      .set(auth(customer.token))
      .send({ text: "How much for a full kitchen?" });
    expect(comment.status).toBe(201);
    const commentId = comment.body.comment._id;

    // Another customer cannot reply as if they were the provider
    const other = await createCustomer();
    const fake = await api()
      .post(`/api/posts/${postId}/comments`)
      .set(auth(other.token))
      .send({ text: "I can do it cheaper", parentId: commentId });
    expect(fake.status).toBe(403);

    const reply = await api()
      .post(`/api/posts/${postId}/comments`)
      .set(auth(provider.token))
      .send({ text: "Around 80k, message me!", parentId: commentId });
    expect(reply.status).toBe(201);

    // Replies are one level deep: no reply to a reply
    const nested = await api()
      .post(`/api/posts/${postId}/comments`)
      .set(auth(provider.token))
      .send({ text: "again", parentId: reply.body.comment._id });
    expect(nested.status).toBe(404);

    const list = await api().get(`/api/posts/${postId}/comments`);
    expect(list.body.comments).toHaveLength(1);
    expect(list.body.comments[0].replies[0].text).toBe("Around 80k, message me!");

    const notes = await api().get("/api/notifications").set(auth(customer.token));
    expect(notes.body.notifications.map((n) => n.type)).toContain("comment_replied");

    // Deleting the comment also deletes its reply
    await api().delete(`/api/posts/${postId}/comments/${commentId}`).set(auth(customer.token));
    expect((await Post.findById(postId)).commentsCount).toBe(0);
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
    const { body } = await createPost(provider);
    const postId = body.post._id;

    const edit = await api()
      .patch(`/api/posts/${postId}`)
      .set(auth(customer.token))
      .send({ text: "hacked" });
    expect(edit.status).toBe(403);

    deleteImages.mockClear();
    const del = await api().delete(`/api/posts/${postId}`).set(auth(admin.token));
    expect(del.status).toBe(200);
    expect(deleteImages).toHaveBeenCalledTimes(1);
    expect(await Post.findById(postId)).toBeNull();
  });

  it("report: once per user, hidden after 5 reports, admin can remove", async () => {
    const { body } = await createPost(provider);
    const postId = body.post._id;

    const ownReport = await api()
      .post(`/api/posts/${postId}/report`)
      .set(auth(provider.token))
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
