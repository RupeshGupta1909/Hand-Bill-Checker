const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');
const { Readable } = require('stream');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

class CloudStorageService {
  async uploadImage(filePath, options = {}) {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: 'hand-bill-checker',
        resource_type: 'image',
        ...options
      });
      console.log('result============>', result);
      return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height
      };
    } catch (error) {
      logger.error('Failed to upload image to Cloudinary:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  async uploadBuffer(buffer, fileName, options = {}) {
    try {
      // Create a promise to handle the upload
      const uploadPromise = new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'hand-bill-checker',
            resource_type: 'image',
            public_id: fileName.replace(/\.[^/.]+$/, ''), // Remove extension
            ...options
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        // Create a readable stream from the buffer and pipe it to the upload stream
        const bufferStream = new Readable();
        bufferStream.push(buffer);
        bufferStream.push(null);
        bufferStream.pipe(uploadStream);
      });

      const result = await uploadPromise;
      console.log('result============>', result);
      return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height
      };
    } catch (error) {
      logger.error('Failed to upload buffer to Cloudinary:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  async deleteImage(publicId) {
    try {
      await cloudinary.uploader.destroy(publicId);
      logger.info(`Deleted image from Cloudinary: ${publicId}`);
    } catch (error) {
      logger.error(`Failed to delete image from Cloudinary: ${publicId}`, error);
    }
  }

  getImageUrl(publicId) {
    return cloudinary.url(publicId, {
      secure: true,
      transformation: [
        { width: 1920, height: 1920, crop: 'limit' },
        { quality: 'auto', fetch_format: 'auto' }
      ]
    });
  }
}

module.exports = new CloudStorageService(); 