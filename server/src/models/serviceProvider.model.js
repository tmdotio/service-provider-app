import mongoose from "mongoose";

const providerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    businessPhone: {
      type: String,
      required: [true, "Business phone number is required"],
      trim: true,
      match: [
        /^\+?[0-9]{10,15}$/,
        "Please provide a valid business phone number",
      ],
    },
    businessName: {
      type: String,
      required: [true, "Business name is required"],
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    experienceYears: {
      type: Number,
      min: 0,
      default: 0,
    },

    categories: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
        },
      ],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "At least one category is required",
      },
    },

    serviceAreas: [
      {
        city: {
          type: String,
          trim: true,
        },

        area: {
          type: String,
          trim: true,
        },
      },
    ],

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },

      coordinates: {
        type: [Number],
        default: undefined,
      },
    },

    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    availabilityStatus: {
      type: String,
      enum: ["available", "busy", "offline"],
      default: "offline",
    },

    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },

    completedJobs: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

providerSchema.index({ location: "2dsphere" });

const ServiceProvider = mongoose.model("provider", providerSchema);

export default ServiceProvider;
