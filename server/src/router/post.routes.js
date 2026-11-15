import { Router } from "express";
import {
  addComment,
  createPost,
  deleteComment,
  deletePost,
  getComments,
  getPostById,
  getPosts,
  reportPost,
  toggleLike,
  updatePost,
} from "../controllers/post.controller.js";
import { authenticate, optionalAuth } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { uploadPostImages } from "../middlewares/upload.middleware.js";
import { validateObjectId } from "../middlewares/validateObjectId.js";
import {
  commentValidator,
  createPostValidator,
  reportValidator,
  updatePostValidator,
} from "../validator/post.validator.js";
import { validateRequest } from "../validator/validateRequest.js";

const postRoute = Router();

/**
 * @route   GET /api/posts
 * @desc    Feed (newest first). Filters: provider, author
 * @access  Public (shows likedByMe when logged in)
 */
postRoute.get("/", optionalAuth, getPosts);

/**
 * @route   POST /api/posts   (multipart/form-data)
 * @desc    Provider posts their own work: before[] (0-2) + after[] (1-2) photos, each < 1 MB
 * @access  Private/Provider
 * @body    text, before (files), after (files)
 */
postRoute.post(
  "/",
  authenticate,
  authorizeRoles("provider"),
  uploadPostImages, // multer must run before validators (it parses the body)
  createPostValidator,
  validateRequest,
  createPost,
);

/**
 * @route   GET /api/posts/:id
 * @access  Public
 */
postRoute.get("/:id", optionalAuth, validateObjectId("id"), getPostById);

/**
 * @route   PATCH /api/posts/:id
 * @desc    Edit post text
 * @access  Private (author)
 */
postRoute.patch(
  "/:id",
  authenticate,
  validateObjectId("id"),
  updatePostValidator,
  validateRequest,
  updatePost,
);

/**
 * @route   DELETE /api/posts/:id
 * @desc    Delete post + its images on ImageKit + comments
 * @access  Private (author or admin)
 */
postRoute.delete("/:id", authenticate, validateObjectId("id"), deletePost);

/**
 * @route   POST /api/posts/:id/like
 * @desc    Like / unlike (toggle)
 * @access  Private
 */
postRoute.post("/:id/like", authenticate, validateObjectId("id"), toggleLike);

/**
 * @route   GET /api/posts/:id/comments
 * @access  Public
 */
postRoute.get("/:id/comments", validateObjectId("id"), getComments);

/**
 * @route   POST /api/posts/:id/comments
 * @desc    Comment (anyone logged in) or reply with parentId (the post's provider only)
 * @access  Private
 */
postRoute.post(
  "/:id/comments",
  authenticate,
  validateObjectId("id"),
  commentValidator,
  validateRequest,
  addComment,
);

/**
 * @route   DELETE /api/posts/:id/comments/:commentId
 * @access  Private (comment author, post author, or admin)
 */
postRoute.delete(
  "/:id/comments/:commentId",
  authenticate,
  validateObjectId("id", "commentId"),
  deleteComment,
);

/**
 * @route   POST /api/posts/:id/report
 * @desc    Report a post. Hidden automatically after 5 reports.
 * @access  Private
 */
postRoute.post(
  "/:id/report",
  authenticate,
  validateObjectId("id"),
  reportValidator,
  validateRequest,
  reportPost,
);

export default postRoute;
