import mongoose from "mongoose";
import ServiceProvider from "../models/serviceProvider.model.js";
import Category from "../models/category.model.js";

/**
 * Create a new category.
 *
 * @route   POST /api/admin/categories
 * @access  Private/Admin
 * @body    name
 */
export const createCategory = async (req, res) => {
  try {
    const name = req.body.name.trim();

    const existingCategory = await Category.findOne({
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: "Category already exists",
      });
    }

    const category = await Category.create({ name });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Category already exists",
      });
    }

    console.error("Create Category Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Update an existing category.
 *
 * @route   PATCH /api/admin/categories/:id
 * @access  Private/Admin
 * @param   id - Category ID
 * @body    name
 */
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const name = req.body.name.trim();

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const existingCategory = await Category.findOne({
      _id: { $ne: id },
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: "Category name already exists",
      });
    }

    const category = await Category.findByIdAndUpdate(
      id,
      { name },
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Category name already exists",
      });
    }

    console.error("Update Category Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Delete an existing category.
 *
 * Prevent deletion if a service provider references it.
 *
 * @route   DELETE /api/admin/categories/:id
 * @access  Private/Admin
 * @param   id - Category ID
 */
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const isCategoryUsed = await ServiceProvider.exists({
      category: id,
    });

    if (isCategoryUsed) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete category because providers are using it",
      });
    }

    await Category.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete Category Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};




/**
 * Get all approved service providers by category.
 *
 * @route   GET /api/provider/category/:categoryId
 * @access  Public
 * @param   categoryId - Category ObjectId
 */
export const getProvidersByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Validate category ID
    if (!mongoose.isObjectIdOrHexString(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    // Find approved providers matching the category
    const providers = await ServiceProvider.find({
      categories: categoryId,
      verificationStatus: "approved",
    })
      .populate({
        path: "user",
        match: {
          role: "provider",
          isActive: true,
        },
        select: "name avatar",
      })
      .populate("categories", "name");

    // Exclude providers with inactive or unmatched users
    const activeProviders = providers.filter(
      (provider) => provider.user !== null
    );

    return res.status(200).json({
      success: true,
      count: activeProviders.length,
      providers: activeProviders,
    });
  } catch (error) {
    console.error("Get Providers By Category Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
