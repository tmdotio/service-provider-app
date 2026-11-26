import ImageKit from "imagekit";

/**
 * Created on first use, so the server and the tests can start
 * even when ImageKit keys are not set.
 */
let client = null;

const getClient = () => {
  if (!client) {
    client = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    });
  }
  return client;
};

const imagekit = {
  upload: (options) => getClient().upload(options),
  deleteFile: (fileId) => getClient().deleteFile(fileId),
};

export default imagekit;
