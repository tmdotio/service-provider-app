import Booking from "../models/booking.model.js";
import Post from "../models/post.model.js";
import Report from "../models/report.model.js";
import ServiceProvider from "../models/serviceProvider.model.js";
import { deleteChatsOfUser } from "../services/chat.service.js";
import { notify } from "../services/notification.service.js";
import { disconnectUser } from "../socket/emitter.js";
import ApiError from "../utils/ApiError.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import User from "../models/user.model.js";

/**
 * Review a pending service provider application.
 *
 * Allows an admin to approve or reject a provider request.
 *
 * If approved:
 * - ServiceProvider application remains in the database
 * - verificationStatus becomes "approved"
 * - linked user's role becomes "provider"
 *
 * If rejected:
 * - rejectionReason is required
 * - ServiceProvider application is deleted
 * - linked user's role remains "customer"
 *
 * @route   PATCH /api/admin/provider-requests/:id/review
 * @access  Private/Admin
 * @param   id - ServiceProvider application ID
 * @body    action - "approve" or "reject"
 * @body    rejectionReason - Required when action is "reject"
 * @returns Review result
 */
export const reviewProviderRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;

    // Validate action
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be either approve or reject",
      });
    }

    // Find provider application using linked User ID
    const providerApplication = await ServiceProvider.findOne({
      user: id,
    });

    if (!providerApplication) {
      return res.status(404).json({
        success: false,
        message: "Provider application not found",
      });
    }


    // Only pending applications can be reviewed
    if (providerApplication.verificationStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Application is already ${providerApplication.verificationStatus}`,
      });
    }

    // APPROVE
    if (action === "approve") {
      const updatedProvider = await ServiceProvider.findOneAndUpdate(
        { user: id },
        {
          verificationStatus: "approved",
        },
        {
          returnDocument: "after",
          runValidators: true,
        },
      );

      const updatedUser = await User.findByIdAndUpdate(
        updatedProvider.user,
        {
          role: "provider",
        },
        {
          returnDocument: "after",
          runValidators: true,
        },
      );

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: "Linked user not found",
        });
      }

      await notify(
        updatedUser._id,
        "provider_approved",
        "Your provider application was approved. Go online to start getting bookings!",
      );

      return res.status(200).json({
        success: true,
        message: "Provider application approved successfully",
        provider: updatedProvider,
      });
    }

    // REJECT
    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    await ServiceProvider.findOneAndDelete({
      user: id,
    });

    await notify(
      id,
      "provider_rejected",
      `Your provider application was rejected. Reason: ${rejectionReason.trim()}`,
    );

    return res.status(200).json({
      success: true,
      message: `Provider application rejected. Reason: ${rejectionReason.trim()}`,
    });
  } catch (error) {
    console.error("Review Provider Request Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get all registered users.
 *
 * Fetches all users from the database while excluding
 * sensitive fields such as password and refresh token.
 *
 * @route   GET /api/admin/users?q=&role=&status=&page=&limit=
 * @access  Private/Admin
 * @query   q (name or email), role (customer|provider), status (active|inactive)
 * @returns One page of users (newest first) + pagination
 */
export const getAllUsers = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query, 20, 100);
    const filter = { role: { $ne: "admin" } };
    if (["customer", "provider"].includes(req.query.role)) filter.role = req.query.role;
    if (req.query.status === "active") filter.isActive = true;
    if (req.query.status === "inactive") filter.isActive = false;
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    if (q) {
      // Escape regex characters so a search like "a+b" is taken literally
      const safe = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: safe }, { email: safe }];
    }

    const [users, total] = await Promise.all([
      User.find(filter).select("-password -refreshToken").sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
      pagination: paginationMeta(total, page, limit),
    });
  } catch (error) {
    console.error("Get All Users Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



/**
 * Get all providers.
 *
 * Fetches all users whose role is "provider"
 * while excluding sensitive fields.
 *
 * @route   GET /api/admin/providers
 * @access  Private/Admin
 * @returns List of providers
 */
export const getAllProviders = async (req, res) => {
  try {
    const providers = await User.find({
      role: "provider",
    })
      .select("-password -refreshToken")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: providers.length,
      providers,
    });
  } catch (error) {
    console.error("Get Providers Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};







/**
 * Get all pending service provider applications.
 *
 * Fetches provider applications whose
 * verificationStatus is "pending".
 *
 * Also populates the linked user's basic details.
 *
 * @route   GET /api/admin/provider-requests/pending
 * @access  Private/Admin
 * @returns Pending provider applications
 */
export const getPendingProviderRequests = async (req, res) => {
  try {
    const requests = await ServiceProvider.find({
      verificationStatus: "pending",
    })
      .populate(
        "user",
        "name email phone avatar role"
      )
      .populate(
        "categories",
        "name"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (error) {
    console.error("Get Pending Provider Requests Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};




/**
 * Update a user's basic account information.
 *
 * Allows an admin to update only approved User model fields.
 * Sensitive fields such as password, refreshToken and role
 * cannot be modified through this controller.
 *
 * @route   PATCH /api/admin/users/:id
 * @access  Private/Admin
 * @param   id - User ID
 * @body    name, email, phone, avatar, isActive
 * @returns Updated user
 */
export const updateUserByAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedFields = [
      "name",
      "email",
      "phone",
      "avatar",
      "isActive",
    ];

    const updateData = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: id,
        role: { $ne: "admin" },
      },
      updateData,
      {
        returnDocument: "after",
        runValidators: true,
      }
    ).select("-password -refreshToken");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Admin Update User Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};






/**
 * Update a provider's complete profile.
 *
 * Updates basic account information in the User model
 * and professional information in the ServiceProvider model.
 *
 * @route   PATCH /api/admin/providers/:userId
 * @access  Private/Admin
 * @param   userId - Provider's User ID
 * @returns Updated user and provider profile
 */
export const updateProviderByAdmin = async (req, res) => {
  try {
    const { userId } = req.params;

    const userAllowedFields = [
      "name",
      "email",
      "phone",
      "avatar",
      "isActive",
    ];

    const providerAllowedFields = [
      "businessName",
      "businessPhone",
      "description",
      "experienceYears",
      "categories",
      "location",
      "availabilityStatus",
    ];

    const userUpdateData = {};
    const providerUpdateData = {};

    // Prepare User model fields
    for (const field of userAllowedFields) {
      if (req.body[field] !== undefined) {
        userUpdateData[field] = req.body[field];
      }
    }

    // Prepare ServiceProvider model fields
    for (const field of providerAllowedFields) {
      if (req.body[field] !== undefined) {
        providerUpdateData[field] = req.body[field];
      }
    }

    // Update basic User data
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: userId,
        role: "provider",
      },
      userUpdateData,
      {
        returnDocument: "after",
        runValidators: true,
      }
    ).select("-password -refreshToken");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "Provider user not found",
      });
    }

    // Update professional provider data
    const updatedProvider = await ServiceProvider.findOneAndUpdate(
      {
        user: userId,
      },
      providerUpdateData,
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!updatedProvider) {
      return res.status(404).json({
        success: false,
        message: "Service provider profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Provider profile updated successfully",
      user: updatedUser,
      provider: updatedProvider,
    });
  } catch (error) {
    console.error("Admin Update Provider Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};




/**
 * Delete a user account by admin.
 *
 * Removes the User document and, if the user is a provider,
 * also removes the linked ServiceProvider profile.
 *
 * @route   DELETE /api/admin/users/:id
 * @access  Private/Admin
 * @returns Account deletion confirmation
 */
export const deleteUserByAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent deletion of admin accounts
    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin account cannot be deleted",
      });
    }

    // Delete linked provider profile if it exists
    if (user.role === "provider") {
      await ServiceProvider.findOneAndDelete({
        user: user._id,
      });
    }

    await deleteChatsOfUser(user._id);
    await User.findByIdAndDelete(user._id);
    disconnectUser(user._id); // their open tabs lose the live chat at once

    return res.status(200).json({
      success: true,
      message: "User account deleted successfully",
    });
  } catch (error) {
    console.error("Admin Delete User Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};




/**
 * Update a user's account status.
 *
 * Allows an admin to activate or deactivate
 * a customer or provider account.
 *
 * Admin accounts cannot be modified through this route.
 *
 * @route   PATCH /api/admin/users/:id/status
 * @access  Private/Admin
 * @returns Updated user status
 */
export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false",
      });
    }

    const user = await User.findOneAndUpdate(
      {
        _id: id,
        role: { $ne: "admin" },
      },
      // Deactivating also signs them out everywhere (no new access tokens)
      isActive ? { isActive } : { isActive, refreshToken: null },
      {
        returnDocument: "after",
        runValidators: true,
      }
    ).select("-password -refreshToken");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // A deactivated user must not keep chatting through an open socket
    if (!isActive) disconnectUser(user._id);

    return res.status(200).json({
      success: true,
      message: isActive
        ? "User account activated successfully"
        : "User account deactivated successfully",
      user,
    });
  } catch (error) {
    console.error("Update User Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};






/**
 * Get a single user's details.
 *
 * Fetches one non-admin user by ID while excluding
 * sensitive fields such as password and refresh token.
 *
 * @route   GET /api/admin/users/:id
 * @access  Private/Admin
 * @param   id - User ID
 * @returns Single user details
 */
export const getSingleCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({
      _id: id,
      role: { $ne: "admin" },
    }).select("-password -refreshToken");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get Single User Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};





/**
 * Get a single provider's complete details.
 *
 * Fetches the provider's professional profile and
 * populates the linked User account information.
 *
 * @route   GET /api/admin/providers/:id
 * @access  Private/Admin
 * @param   id - Provider's User ID
 * @returns Complete provider details
 */
export const getSingleProvider = async (req, res) => {
  try {
    const { id } = req.params;

    const provider = await ServiceProvider.findOne({
      user: id,
      verificationStatus: "approved",
    })
      .populate(
        "user",
        "name email phone avatar role isActive createdAt updatedAt"
      )
      

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Service provider not found",
      });
    }
    
    return res.status(200).json({
      success: true,
      provider,
    });
  } catch (error) {
    console.error("Get Single Provider Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};





/**
 * Get admin dashboard statistics.
 *
 * Fetches platform-level counts for users,
 * customers, providers, active/inactive accounts,
 * and pending provider applications.
 *
 * @route   GET /api/admin/dashboard-stats
 * @access  Private/Admin
 * @returns Dashboard statistics
 */
export const getDashboardStats = async (req, res) => {
  const [
    totalUsers,
    totalCustomers,
    totalProviders,
    activeUsers,
    inactiveUsers,
    pendingProviderRequests,
    bookingsByStatusRaw,
    totalPosts,
    pendingReports,
    topProviders,
  ] = await Promise.all([
    User.countDocuments({ role: { $ne: "admin" } }),
    User.countDocuments({ role: "customer" }),
    User.countDocuments({ role: "provider" }),
    User.countDocuments({ role: { $ne: "admin" }, isActive: true }),
    User.countDocuments({ role: { $ne: "admin" }, isActive: false }),
    ServiceProvider.countDocuments({ verificationStatus: "pending" }),
    Booking.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Post.countDocuments(),
    Report.countDocuments({ status: "pending" }),
    ServiceProvider.find({ verificationStatus: "approved" })
      .sort({ completedJobs: -1, averageRating: -1 })
      .limit(5)
      .select("businessName completedJobs averageRating noShowCount")
      .lean(),
  ]);

  const bookingsByStatus = Object.fromEntries(
    bookingsByStatusRaw.map((item) => [item._id, item.count]),
  );
  const totalBookings = bookingsByStatusRaw.reduce((sum, i) => sum + i.count, 0);

  return res.status(200).json({
    success: true,
    stats: {
      totalUsers,
      totalCustomers,
      totalProviders,
      activeUsers,
      inactiveUsers,
      pendingProviderRequests,
      totalBookings,
      bookingsByStatus,
      totalPosts,
      pendingReports,
      topProviders,
    },
  });
};

/**
 * All bookings with filters.
 *
 * @route   GET /api/admin/bookings?status=&page=&limit=
 * @access  Private/Admin
 */
export const getAllBookings = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20);

  const filter = {};
  if (req.query.status) {
    filter.status = String(req.query.status);
  }

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customer", "name email phone")
      .populate("provider", "businessName businessPhone")
      .populate("category", "name")
      .lean(),
    Booking.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    bookings,
    pagination: paginationMeta(total, page, limit),
  });
};

/**
 * Reported posts, grouped by post, most reported first.
 *
 * @route   GET /api/admin/reports?status=pending
 * @access  Private/Admin
 */
export const getReports = async (req, res) => {
  const status = req.query.status || "pending";
  const { page, limit, skip } = getPagination(req.query, 20);

  const [result] = await Report.aggregate([
    { $match: { status } },
    {
      $group: {
        _id: "$post",
        reportsCount: { $sum: 1 },
        reasons: { $addToSet: "$reason" },
        details: { $push: "$details" },
        lastReportedAt: { $max: "$createdAt" },
      },
    },
    { $sort: { reportsCount: -1, lastReportedAt: -1 } },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "posts",
              localField: "_id",
              foreignField: "_id",
              as: "post",
              pipeline: [{ $project: { likes: 0 } }],
            },
          },
          { $unwind: { path: "$post", preserveNullAndEmptyArrays: true } },
        ],
        total: [{ $count: "count" }],
      },
    },
  ]);

  const total = result.total[0]?.count || 0;

  res.status(200).json({
    success: true,
    reports: result.items,
    pagination: paginationMeta(total, page, limit),
  });
};

/**
 * Resolve all pending reports of a post.
 *
 * - action "remove":  hide the post and tell the author
 * - action "dismiss": reports were wrong, show the post again
 *
 * @route   PATCH /api/admin/reports/:postId
 * @access  Private/Admin
 * @body    action: "remove" | "dismiss"
 */
export const resolveReports = async (req, res) => {
  const { postId } = req.params;
  const { action } = req.body;

  if (!["remove", "dismiss"].includes(action)) {
    throw new ApiError(400, "Action must be remove or dismiss");
  }

  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  const result = await Report.updateMany(
    { post: post._id, status: "pending" },
    {
      status: action === "remove" ? "action_taken" : "dismissed",
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
    },
  );

  if (result.matchedCount === 0) {
    throw new ApiError(404, "No pending reports for this post");
  }

  post.isHidden = action === "remove";
  await post.save();

  if (action === "remove") {
    await notify(
      post.author,
      "post_removed",
      "One of your posts was removed because it broke the community rules",
      { post: post._id },
    );
  }

  res.status(200).json({
    success: true,
    message:
      action === "remove"
        ? "Post removed and reports closed"
        : "Reports dismissed and post is visible",
    reportsResolved: result.modifiedCount,
  });
};