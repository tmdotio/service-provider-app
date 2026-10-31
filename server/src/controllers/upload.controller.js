import imagekit from "../config/imageKit.js";

/**
 * Upload profile image.
 *
 * Receives an image through Multer memory storage
 * and uploads the image buffer directly to ImageKit.
 *
 * @route   PATCH /api/upload/image
 * @access  Private
 * @returns ImageKit image URL and file ID
 */
export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select an image",
      });
    }

    const result = await imagekit.upload({
      file: req.file.buffer,
      fileName: `${Date.now()}_${req.file.originalname}`,
      folder: "/service-provider-app/avatars",
    });

    return res.status(200).json({
      success: true,
      message: "Profile image updated successfully",
      image: {
        url: result.url,
        fileId: result.fileId,
      },
    });
  } catch (error) {
    console.error("Image Upload Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to upload image",
    });
  }
};