import User from "../models/user.model.js";
import { uploadImage } from "../services/imageStorage.service.js";
import ApiError from "../utils/ApiError.js";

/**
 * Upload profile image (max 1 MB) and save it as the user's avatar.
 *
 * Multer keeps the file in memory and the buffer goes
 * directly to ImageKit.
 *
 * @route   PATCH /api/upload/avatar   (multipart/form-data, field "image")
 * @access  Private
 * @returns ImageKit image URL and file ID
 */
export const uploadProfileImage = async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Please select an image");
  }

  const image = await uploadImage(req.file, "avatars");

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { avatar: image.url },
    { returnDocument: "after" },
  );

  res.status(200).json({
    success: true,
    message: "Profile image updated successfully",
    image,
    user,
  });
};
