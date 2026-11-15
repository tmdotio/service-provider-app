import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    fileId: { type: String, required: true },
  },
  { _id: false },
);

/**
 * A post with images about a service provider's work.
 *
 * - type "showcase":   the provider posts photos of their own work
 * - type "experience": a customer shows how the provider worked
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

    type: {
      type: String,
      enum: ["showcase", "experience"],
      required: true,
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

    // Author had a completed booking with this provider
    isVerifiedCustomer: {
      type: Boolean,
      default: false,
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
