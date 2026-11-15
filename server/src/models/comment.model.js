import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Set when this is the provider's reply to a comment (one level deep)
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },

    text: {
      type: String,
      trim: true,
      required: [true, "Comment text is required"],
      maxlength: [500, "Comment cannot exceed 500 characters"],
    },
  },
  { timestamps: true },
);

commentSchema.index({ post: 1, parent: 1, createdAt: -1 });

const Comment = mongoose.model("Comment", commentSchema);

export default Comment;
