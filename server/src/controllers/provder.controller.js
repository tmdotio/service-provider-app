
import Category from "../models/category.model.js";
import ServiceProvider from "../models/serviceProvider.model.js";

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
      serviceAreas,
      location,
    } = req.body;

    // Check if user already has a provider application
    const existingApplication = await ServiceProvider.findOne({
      user: req.user._id,
    });

    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: "You have already submitted a provider application",
      });
    }

    // Verify that all selected categories exist
    const existingCategories = await Category.countDocuments({
      _id: { $in: categories },
    });

    if (existingCategories !== categories.length) {
      return res.status(400).json({
        success: false,
        message: "One or more selected categories do not exist",
      });
    }

    // Create pending provider application
    const providerApplication = await ServiceProvider.create({
      user: req.user._id,
      businessName,
      businessPhone,
      description,
      experienceYears,
      categories,
      serviceAreas,
      location,
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
