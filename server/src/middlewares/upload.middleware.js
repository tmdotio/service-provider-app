import multer from "multer";
import ApiError from "../utils/ApiError.js";

export const MAX_IMAGE_SIZE = 1 * 1024 * 1024; // 1 MB
export const MAX_POST_IMAGES = 4;

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Files stay in memory (Buffer) and go straight to ImageKit.
 *
 * FIX: the option is `limits` (with "s"). The old code used `limit`,
 * which multer ignores, so the 1 MB limit was never applied.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: MAX_POST_IMAGES,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, "Only JPG, PNG and WEBP images are allowed"));
    }
  },
});

/**
 * Check the real file type from its first bytes ("magic numbers").
 * The mimetype comes from the client and can be faked; the bytes can't.
 */
const isRealImage = (buffer) => {
  if (!buffer || buffer.length < 12) return false;

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const isWebp =
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";

  return isJpeg || isPng || isWebp;
};

export const verifyImageContent = (req, res, next) => {
  const files = req.files || (req.file ? [req.file] : []);

  for (const file of files) {
    if (!isRealImage(file.buffer)) {
      return next(
        new ApiError(400, `${file.originalname} is not a valid image file`),
      );
    }
  }

  next();
};

/** One image in the "image" field (avatar). */
export const uploadSingleImage = [upload.single("image"), verifyImageContent];

/** 1-4 images in the "images" field (posts). */
export const uploadPostImages = [
  upload.array("images", MAX_POST_IMAGES),
  verifyImageContent,
];

export default upload;
