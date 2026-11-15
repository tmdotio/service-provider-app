
import mongoose from "mongoose";
import Booking from "../models/booking.model.js";
import Category from "../models/category.model.js";
import Post from "../models/post.model.js";
import Review from "../models/review.model.js";
import ServiceProvider from "../models/serviceProvider.model.js";
import { deleteImages, uploadImage } from "../services/imageStorage.service.js";
import ApiError from "../utils/ApiError.js";
import {
  escapeRegex,
  getPagination,
  paginationMeta,
} from "../utils/pagination.js";

/**
 * Submit an application to become a service provider.
 *
 * @route   POST /api/provider/become-provider
 * @access  Private/Customer
 * @body    businessName, businessPhone, description,
 *          experienceYears, categories, serviceAreas, location
 */
export const becomeServiceProvider = async (req, res) => {
  try {
    const {
      businessName,
      businessPhone,
      description,
      experienceYears,
      categories,
      location,
    } = req.body;

    // 1. Check if user already has a provider application
    const existingApplication = await ServiceProvider.findOne({
      user: req.user._id,
    });

    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: "You have already submitted a provider application",
      });
    }

    // 2. Validate categories
    if (
      !Array.isArray(categories) ||
      categories.length === 0 ||
      new Set(categories).size !== categories.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one unique category",
      });
    }

    // 3. Verify selected categories exist
    const existingCategories = await Category.countDocuments({
      _id: { $in: categories },
    });

    if (existingCategories !== categories.length) {
      return res.status(400).json({
        success: false,
        message: "One or more selected categories do not exist",
      });
    }

    // 4. Validate location
    if (
      !location ||
      typeof location !== "object" ||
      Array.isArray(location) ||
      !["city", "province", "country"].every(
        (field) =>
          typeof location[field] === "string" &&
          location[field].trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "City, province and country are required",
      });
    }

    // 5. Create provider application
    const providerApplication = await ServiceProvider.create({
      user: req.user._id,
      businessName,
      businessPhone,
      description,
      experienceYears,
      categories,
      location: {
        city: location.city.trim(),
        province: location.province.trim(),
        country: location.country.trim(),
      },
      verificationStatus: "pending",
      availabilityStatus: "offline",
    });

    return res.status(201).json({
      success: true,
      message:
        "Service provider application submitted successfully. Waiting for admin approval.",
      provider: providerApplication,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Provider application already exists",
      });
    }

    if (error.name === "ValidationError" ||
        error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid provider application data",
      });
    }

    console.error("Become Service Provider Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


/**
 * Get the authenticated provider's professional profile.
 *
 * @route   GET /api/provider/me
 * @access  Private/Provider
 */
export const getMyProviderProfile = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({
      user: req.user._id,
      verificationStatus: "approved",
    })
      .populate(
        "user",
        "name email phone avatar role"
      )
      .populate("categories", "name");

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      provider,
    });
  } catch (error) {
    console.error("Get My Provider Profile Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



/**
 * See my provider application and its status (pending / approved).
 *
 * @route   GET /api/provider/application
 * @access  Private
 */
export const getMyApplication = async (req, res) => {
  const application = await ServiceProvider.findOne({
    user: req.user._id,
  }).populate("categories", "name");

  if (!application) {
    throw new ApiError(404, "You have not applied to become a provider");
  }

  res.status(200).json({ success: true, application });
};

/**
 * Update my professional profile.
 *
 * @route   PATCH /api/provider/me
 * @access  Private/Provider
 * @body    businessName?, businessPhone?, description?,
 *          experienceYears?, categories?, location{city,province,country}?
 */
export const updateMyProviderProfile = async (req, res) => {
  const allowedFields = [
    "businessName",
    "businessPhone",
    "description",
    "experienceYears",
    "categories",
  ];

  const updateData = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  }

  // Location: update only the parts that were sent
  if (req.body.location) {
    for (const part of ["city", "province", "country"]) {
      if (req.body.location[part] !== undefined) {
        updateData[`location.${part}`] = req.body.location[part];
      }
    }
  }

  if (updateData.categories) {
    const count = await Category.countDocuments({
      _id: { $in: updateData.categories },
    });
    if (count !== updateData.categories.length) {
      throw new ApiError(400, "One or more selected categories do not exist");
    }
  }

  const provider = await ServiceProvider.findOneAndUpdate(
    { user: req.user._id, verificationStatus: "approved" },
    { $set: updateData },
    { returnDocument: "after", runValidators: true },
  ).populate("categories", "name");

  if (!provider) {
    throw new ApiError(404, "Provider profile not found");
  }

  res.status(200).json({
    success: true,
    message: "Provider profile updated successfully",
    provider,
  });
};

/**
 * Go online / offline.
 *
 * "busy" is set by the system when you accept a booking, so you
 * cannot set it yourself, and you cannot change status during a job.
 *
 * @route   PATCH /api/provider/me/availability
 * @access  Private/Provider
 * @body    availabilityStatus: "available" | "offline"
 */
export const updateAvailability = async (req, res) => {
  const provider = await ServiceProvider.findOne({
    user: req.user._id,
    verificationStatus: "approved",
  });

  if (!provider) {
    throw new ApiError(404, "Provider profile not found");
  }

  const hasActiveJob = await Booking.exists({
    provider: provider._id,
    status: "in_progress",
  });

  if (hasActiveJob) {
    throw new ApiError(
      409,
      "You have a job in progress. Complete or cancel it first.",
    );
  }

  provider.availabilityStatus = req.body.availabilityStatus;
  await provider.save();

  res.status(200).json({
    success: true,
    message: `You are now ${provider.availabilityStatus}`,
    availabilityStatus: provider.availabilityStatus,
  });
};

/**
 * Search approved providers with filters, sorting and pagination.
 *
 * @route   GET /api/provider
 * @access  Public
 * @query   q, category, city, province, minRating,
 *          availability (available|busy|offline),
 *          sort = rating | jobs | newest | experience,
 *          page, limit
 */
export const searchProviders = async (req, res) => {
  const { q, category, city, province, minRating, availability } = req.query;
  const sort = req.query.sort || "rating";
  const { page, limit, skip } = getPagination(req.query);

  const match = { verificationStatus: "approved" };

  if (category) {
    if (!mongoose.isValidObjectId(category)) {
      throw new ApiError(400, "Invalid category");
    }
    match.categories = new mongoose.Types.ObjectId(String(category));
  }

  if (city) {
    match["location.city"] = new RegExp(`^${escapeRegex(city)}$`, "i");
  }

  if (province) {
    match["location.province"] = new RegExp(`^${escapeRegex(province)}$`, "i");
  }

  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    match.$or = [{ businessName: regex }, { description: regex }];
  }

  if (minRating) {
    match.averageRating = { $gte: Number(minRating) || 0 };
  }

  if (availability) {
    match.availabilityStatus = String(availability);
  }

  const sortOptions = {
    rating: { averageRating: -1, totalReviews: -1 },
    jobs: { completedJobs: -1 },
    newest: { createdAt: -1 },
    experience: { experienceYears: -1 },
  };

  const [result] = await ServiceProvider.aggregate([
    { $match: match },
    // Only providers whose user account is active
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
        pipeline: [{ $project: { name: 1, avatar: 1, isActive: 1 } }],
      },
    },
    { $unwind: "$user" },
    { $match: { "user.isActive": true } },
    { $sort: { ...(sortOptions[sort] || sortOptions.rating), _id: 1 } },
    {
      $facet: {
        providers: [
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "categories",
              localField: "categories",
              foreignField: "_id",
              as: "categories",
              pipeline: [{ $project: { name: 1 } }],
            },
          },
          {
            $project: {
              businessName: 1,
              description: 1,
              experienceYears: 1,
              categories: 1,
              location: 1,
              availabilityStatus: 1,
              averageRating: 1,
              totalReviews: 1,
              completedJobs: 1,
              noShowCount: 1,
              "bannerImage.url": 1,
              "user._id": 1,
              "user.name": 1,
              "user.avatar": 1,
            },
          },
        ],
        total: [{ $count: "count" }],
      },
    },
  ]);

  const total = result.total[0]?.count || 0;

  res.status(200).json({
    success: true,
    providers: result.providers,
    pagination: paginationMeta(total, page, limit),
  });
};

/**
 * Public provider profile with latest reviews and number of posts.
 *
 * @route   GET /api/provider/:id   (ServiceProvider _id)
 * @access  Public
 */
export const getProviderPublicProfile = async (req, res) => {
  const provider = await ServiceProvider.findOne({
    _id: req.params.id,
    verificationStatus: "approved",
  })
    .populate({
      path: "user",
      match: { isActive: true },
      select: "name avatar createdAt",
    })
    .populate("categories", "name")
    // Phone is shared only with customers who book (see booking details)
    .select("-businessPhone");

  if (!provider || !provider.user) {
    throw new ApiError(404, "Provider not found");
  }

  const [latestReviews, postsCount] = await Promise.all([
    Review.find({ provider: provider._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("customer", "name avatar"),
    Post.countDocuments({ provider: provider._id, isHidden: false }),
  ]);

  res.status(200).json({
    success: true,
    provider,
    latestReviews,
    postsCount,
  });
};

/**
 * Upload or replace my banner (cover) image. Max 1 MB.
 * The old banner is deleted from ImageKit.
 *
 * @route   PATCH /api/provider/me/banner   (multipart/form-data, field "image")
 * @access  Private/Provider
 */
export const updateBanner = async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Please select an image");
  }

  const provider = await ServiceProvider.findOne({
    user: req.user._id,
    verificationStatus: "approved",
  });

  if (!provider) {
    throw new ApiError(404, "Provider profile not found");
  }

  const oldBanner = provider.bannerImage?.fileId ? { ...provider.bannerImage } : null;
  const image = await uploadImage(req.file, "banners");

  provider.bannerImage = image;
  await provider.save();

  if (oldBanner) await deleteImages([oldBanner]);

  res.status(200).json({
    success: true,
    message: "Banner updated",
    bannerImage: provider.bannerImage,
  });
};

/**
 * Remove my banner image.
 *
 * @route   DELETE /api/provider/me/banner
 * @access  Private/Provider
 */
export const removeBanner = async (req, res) => {
  const provider = await ServiceProvider.findOne({
    user: req.user._id,
    verificationStatus: "approved",
  });

  if (!provider) {
    throw new ApiError(404, "Provider profile not found");
  }

  if (provider.bannerImage?.fileId) {
    await deleteImages([{ fileId: provider.bannerImage.fileId }]);
  }
  provider.bannerImage = { url: "", fileId: "" };
  await provider.save();

  res.status(200).json({ success: true, message: "Banner removed" });
};
