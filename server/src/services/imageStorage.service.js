import imagekit from "../config/imageKit.js";

/**
 * All ImageKit calls go through this file, so controllers stay
 * simple and tests can replace it with a fake.
 */

/**
 * Upload one image buffer.
 * @returns {Promise<{ url: string, fileId: string }>}
 */
export const uploadImage = async (file, folder) => {
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");

  const result = await imagekit.upload({
    file: file.buffer,
    fileName: `${Date.now()}_${safeName}`,
    folder: `/service-provider-app/${folder}`,
  });

  return { url: result.url, fileId: result.fileId };
};

/**
 * Upload many images in parallel. If one fails, delete the ones
 * that already uploaded so no orphan files stay on ImageKit.
 */
export const uploadImages = async (files, folder) => {
  const results = await Promise.allSettled(
    files.map((file) => uploadImage(file, folder)),
  );

  const uploaded = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);

  const failed = results.find((r) => r.status === "rejected");

  if (failed) {
    await deleteImages(uploaded);
    throw failed.reason;
  }

  return uploaded;
};

/**
 * Delete images from ImageKit. Never throws: a failed cleanup
 * should not break the user's request.
 */
export const deleteImages = async (images = []) => {
  await Promise.allSettled(
    images
      .filter((img) => img?.fileId)
      .map((img) => imagekit.deleteFile(img.fileId)),
  );
};
