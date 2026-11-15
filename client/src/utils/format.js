export const APP_NAME = "Ustaad";
export const APP_TAGLINE = "Skilled pros you can trust";

/** "5 minutes ago", "2 days ago"... */
export const timeAgo = (date) => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [name, size] of units) {
    const value = Math.floor(seconds / size);
    if (value >= 1) return `${value} ${name}${value > 1 ? "s" : ""} ago`;
  }
  return "just now";
};

export const formatDate = (date) =>
  new Date(date).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });

export const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

export const MAX_IMAGE_MB = 1;
export const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Returns an error message, or null if the file is OK. */
export const checkImageFile = (file) => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `${file.name}: only JPG, PNG or WEBP images are allowed`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. Max is ${MAX_IMAGE_MB} MB.`;
  }
  return null;
};
