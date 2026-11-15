import mongoose from "mongoose";
import Booking from "../models/booking.model.js";
import Comment from "../models/comment.model.js";
import Post from "../models/post.model.js";
import Report from "../models/report.model.js";
import ServiceProvider from "../models/serviceProvider.model.js";
import { deleteImages, uploadImages } from "../services/imageStorage.service.js";
import { notify } from "../services/notification.service.js";
import ApiError from "../utils/ApiError.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";

const MAX_POSTS_PER_DAY = 10;
// Post is hidden automatically when this many users report it
const AUTO_HIDE_REPORTS = 5;

const POPULATE_POST = [
  { path: "author", select: "name avatar role" },
  { path: "provider", select: "businessName averageRating user" },
];

/**
 * Add `likedByMe` to each post and remove the raw likes array
 * (it can be very large and leaks who liked).
 */
const withLikedByMe = (posts, userId) =>
  posts.map((post) => {
    const obj = post.toObject ? post.toObject() : post;
    const likedByMe = userId
      ? obj.likes.some((id) => id.equals(userId))
      : false;
    delete obj.likes;
    return { ...obj, likedByMe };
  });

const findVisiblePost = async (postId) => {
  const post = await Post.findById(postId);
  if (!post || post.isHidden) {
    throw new ApiError(404, "Post not found");
  }
  return post;
};

/**
 * Create a post with 1-4 images (each under 1 MB) about a provider.
 *
 * - If you ARE the provider: a "showcase" post of your work.
 * - Otherwise: an "experience" post about how the provider worked.
 *   It gets a "verified customer" badge if you had a completed booking.
 *
 * @route   POST /api/posts   (multipart/form-data)
 * @access  Private
 * @body    providerId, text, images[] (files)
 */
export const createPost = async (req, res) => {
  const { providerId, text } = req.body;
  const files = req.files || [];

  if (files.length === 0) {
    throw new ApiError(400, "Please add at least one image");
  }

  const provider = await ServiceProvider.findOne({
    _id: providerId,
    verificationStatus: "approved",
  }).select("_id user");

  if (!provider) {
    throw new ApiError(404, "Provider not found");
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const postsToday = await Post.countDocuments({
    author: req.user._id,
    createdAt: { $gte: since },
  });
  if (postsToday >= MAX_POSTS_PER_DAY) {
    throw new ApiError(429, `You can create up to ${MAX_POSTS_PER_DAY} posts per day`);
  }

  const isOwnProfile = provider.user.equals(req.user._id);

  const isVerifiedCustomer =
    !isOwnProfile &&
    Boolean(
      await Booking.exists({
        customer: req.user._id,
        provider: provider._id,
        status: "completed",
      }),
    );

  // Upload only after all checks pass
  const images = await uploadImages(files, "posts");

  let post;
  try {
    post = await Post.create({
      author: req.user._id,
      provider: provider._id,
      type: isOwnProfile ? "showcase" : "experience",
      text,
      images,
      isVerifiedCustomer,
    });
  } catch (error) {
    // Saving failed -> remove the images we just uploaded
    await deleteImages(images);
    throw error;
  }

  await post.populate(POPULATE_POST);

  res.status(201).json({
    success: true,
    message: "Post created",
    post: withLikedByMe([post], req.user._id)[0],
  });
};

/**
 * Feed of posts (newest first), optionally filtered.
 *
 * @route   GET /api/posts
 * @access  Public (shows likedByMe if logged in)
 * @query   provider, author, type, page, limit
 */
export const getPosts = async (req, res) => {
  const { provider, author, type } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = { isHidden: false };

  for (const [key, value] of Object.entries({ provider, author })) {
    if (value) {
      if (!mongoose.isValidObjectId(value)) {
        throw new ApiError(400, `Invalid ${key}`);
      }
      filter[key] = value;
    }
  }

  if (type) {
    filter.type = String(type);
  }

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(POPULATE_POST),
    Post.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    posts: withLikedByMe(posts, req.user?._id),
    pagination: paginationMeta(total, page, limit),
  });
};

/**
 * One post.
 *
 * @route   GET /api/posts/:id
 * @access  Public
 */
export const getPostById = async (req, res) => {
  const post = await findVisiblePost(req.params.id);
  await post.populate(POPULATE_POST);

  res.status(200).json({
    success: true,
    post: withLikedByMe([post], req.user?._id)[0],
  });
};

/**
 * Edit the text of your post.
 *
 * @route   PATCH /api/posts/:id
 * @access  Private (author)
 * @body    text
 */
export const updatePost = async (req, res) => {
  const post = await findVisiblePost(req.params.id);

  if (!post.author.equals(req.user._id)) {
    throw new ApiError(403, "You can only edit your own post");
  }

  post.text = req.body.text;
  await post.save();
  await post.populate(POPULATE_POST);

  res.status(200).json({
    success: true,
    message: "Post updated",
    post: withLikedByMe([post], req.user._id)[0],
  });
};

/**
 * Delete a post, its images on ImageKit, its comments and reports.
 *
 * @route   DELETE /api/posts/:id
 * @access  Private (author or admin)
 */
export const deletePost = async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  if (!post.author.equals(req.user._id) && req.user.role !== "admin") {
    throw new ApiError(403, "You can only delete your own post");
  }

  await Promise.all([
    post.deleteOne(),
    Comment.deleteMany({ post: post._id }),
    Report.deleteMany({ post: post._id }),
  ]);
  await deleteImages(post.images);

  res.status(200).json({
    success: true,
    message: "Post deleted",
  });
};

/**
 * Like or unlike a post (toggle).
 *
 * Uses conditional atomic updates so double-clicks or parallel
 * requests can never make likesCount wrong.
 *
 * @route   POST /api/posts/:id/like
 * @access  Private
 */
export const toggleLike = async (req, res) => {
  const post = await findVisiblePost(req.params.id);
  const userId = req.user._id;

  // Try to unlike (only matches if I already liked)
  let updated = await Post.findOneAndUpdate(
    { _id: post._id, likes: userId },
    { $pull: { likes: userId }, $inc: { likesCount: -1 } },
    { returnDocument: "after" },
  );

  let liked = false;

  if (!updated) {
    // Not liked yet -> like (only matches if I have not liked)
    updated = await Post.findOneAndUpdate(
      { _id: post._id, likes: { $ne: userId } },
      { $addToSet: { likes: userId }, $inc: { likesCount: 1 } },
      { returnDocument: "after" },
    );
    liked = Boolean(updated);

    if (liked && !post.author.equals(userId)) {
      await notify(post.author, "post_liked", `${req.user.name} liked your post`, {
        post: post._id,
      });
    }
  }

  const fresh = updated || (await Post.findById(post._id));

  res.status(200).json({
    success: true,
    liked,
    likesCount: fresh.likesCount,
  });
};

/**
 * Comments of a post (newest first).
 *
 * @route   GET /api/posts/:id/comments
 * @access  Public
 */
export const getComments = async (req, res) => {
  const post = await findVisiblePost(req.params.id);
  const { page, limit, skip } = getPagination(req.query, 20);

  const [comments, total] = await Promise.all([
    Comment.find({ post: post._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "name avatar role"),
    Comment.countDocuments({ post: post._id }),
  ]);

  res.status(200).json({
    success: true,
    comments,
    pagination: paginationMeta(total, page, limit),
  });
};

/**
 * Add a comment.
 *
 * @route   POST /api/posts/:id/comments
 * @access  Private
 * @body    text
 */
export const addComment = async (req, res) => {
  const post = await findVisiblePost(req.params.id);

  const comment = await Comment.create({
    post: post._id,
    author: req.user._id,
    text: req.body.text,
  });

  await Post.findByIdAndUpdate(post._id, { $inc: { commentsCount: 1 } });

  if (!post.author.equals(req.user._id)) {
    await notify(
      post.author,
      "post_commented",
      `${req.user.name} commented on your post`,
      { post: post._id },
    );
  }

  await comment.populate("author", "name avatar role");

  res.status(201).json({
    success: true,
    message: "Comment added",
    comment,
  });
};

/**
 * Delete a comment.
 *
 * @route   DELETE /api/posts/:id/comments/:commentId
 * @access  Private (comment author, post author, or admin)
 */
export const deleteComment = async (req, res) => {
  const comment = await Comment.findOne({
    _id: req.params.commentId,
    post: req.params.id,
  });

  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  const post = await Post.findById(req.params.id).select("author");

  const canDelete =
    comment.author.equals(req.user._id) ||
    post?.author.equals(req.user._id) ||
    req.user.role === "admin";

  if (!canDelete) {
    throw new ApiError(403, "You cannot delete this comment");
  }

  await comment.deleteOne();
  await Post.findByIdAndUpdate(req.params.id, { $inc: { commentsCount: -1 } });

  res.status(200).json({
    success: true,
    message: "Comment deleted",
  });
};

/**
 * Report a post (fake, abusive, spam...). Each user once per post.
 * After 5 reports the post is hidden until an admin reviews it.
 *
 * @route   POST /api/posts/:id/report
 * @access  Private
 * @body    reason, details?
 */
export const reportPost = async (req, res) => {
  const post = await findVisiblePost(req.params.id);

  if (post.author.equals(req.user._id)) {
    throw new ApiError(400, "You cannot report your own post");
  }

  try {
    await Report.create({
      post: post._id,
      reportedBy: req.user._id,
      reason: req.body.reason,
      details: req.body.details,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, "You have already reported this post");
    }
    throw error;
  }

  const pendingReports = await Report.countDocuments({
    post: post._id,
    status: "pending",
  });

  if (pendingReports >= AUTO_HIDE_REPORTS) {
    await Post.findByIdAndUpdate(post._id, { isHidden: true });
  }

  res.status(201).json({
    success: true,
    message: "Thanks. An admin will review this post.",
  });
};
