import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    fileId: { type: String, required: true },
    // "before" = condition before the job, "after" = finished work
    label: { type: String, enum: ["before", "after"], default: "after" },
  },
  { _id: false },
);

/**
 * A provider's post about their own work, with before/after photos.
 * Only providers post; customers can comment and the provider replies.
 */
const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "provider",
      required: [true, "Provider is required"],
    },

    text: {
      type: String,
      trim: true,
      required: [true, "Post text is required"],
      minlength: [3, "Post text must be at least 3 characters"],
      maxlength: [2000, "Post text cannot exceed 2000 characters"],
    },

    images: {
      type: [imageSchema],
      validate: {
        validator: (images) => images.length >= 1 && images.length <= 4,
        message: "A post must have 1 to 4 images",
      },
    },

    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    likesCount: { type: Number, default: 0 },

    commentsCount: { type: Number, default: 0 },

    // Hidden after many reports or by an admin
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true },
);

postSchema.index({ isHidden: 1, createdAt: -1 });
postSchema.index({ provider: 1, createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });

const Post = mongoose.model("Post", postSchema);

export default Post;
