import ServiceProvider from "../models/serviceProvider.model.js";
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

    console.log("User ID:", providerApplication.user);

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
 * @route   GET /api/admin/users
 * @access  Private/Admin
 * @returns All registered users
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({
      role: { $ne: "admin" },
    })
      .select("-password -refreshToken")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
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
        "category",
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
      "category",
      "serviceAreas",
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

    await User.findByIdAndDelete(user._id);

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
      {
        isActive,
      },
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
  try {
    const totalUsers = await User.countDocuments({
      role: { $ne: "admin" },
    });

    const totalCustomers = await User.countDocuments({
      role: "customer",
    });

    const totalProviders = await User.countDocuments({
      role: "provider",
    });

    const activeUsers = await User.countDocuments({
      role: { $ne: "admin" },
      isActive: true,
    });

    const inactiveUsers = await User.countDocuments({
      role: { $ne: "admin" },
      isActive: false,
    });

    const pendingProviderRequests =
      await ServiceProvider.countDocuments({
        verificationStatus: "pending",
      });

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalCustomers,
        totalProviders,
        activeUsers,
        inactiveUsers,
        pendingProviderRequests,
      },
    });
  } catch (error) {
    console.error("Get Dashboard Stats Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};