import category from "../models/gallery.js";
import sequelize from "../models/connect.js";
import initModels from "../models/init-models.js";
import cloudinary from '../config/cloudinary.js';
import { promises as fs } from 'fs';
// import bcrypt from "bcrypt";
import { Op } from "sequelize";
// import bcrypt from "bcrypt";
// import jwt from "jsonwebtoken";
// import transporter from "../config/transporter.js";
// import { createRefToken, createToken } from "../config/jwt.js";

const model = initModels(sequelize);

// Thêm gallery với nhiều ảnh
const insertGallery = async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ message: 'Vui lòng cung cấp tên gallery' });
      }
  
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'Vui lòng upload ít nhất một ảnh' });
      }
  
      // Upload từng ảnh lên Cloudinary và lưu URL vào mảng
      const imageUrls = [];
      for (const file of req.files) {
        console.log('Bắt đầu upload ảnh lên Cloudinary:', file.path);
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'gallery',
          resource_type: 'image',
        });
        console.log('Upload thành công:', result.secure_url);
        imageUrls.push(result.secure_url);
  
        // Xóa file tạm
        console.log('Xóa file tạm:', file.path);
        await fs.unlink(file.path);
        console.log('Đã xóa file tạm thành công');
      }
  
      // Tạo bản ghi gallery với danh sách URL ảnh dưới dạng JSON
      const newGallery = await model.gallery.create({
        name: name,
        thumbnail: JSON.stringify(imageUrls),
      });
  
      return res.status(201).json({
        message: 'Thêm gallery thành công',
        data: {
          id_gallery: newGallery.id_gallery,
          name: newGallery.name,
          thumbnails: JSON.parse(newGallery.thumbnail), // Parse JSON để trả về mảng
        },
      });
    } catch (error) {
      console.error('Error inserting gallery:', error);
      if (req.files) {
        for (const file of req.files) {
          await fs.unlink(file.path).catch(err => console.error('Lỗi xóa file tạm:', err));
        }
      }
      return res.status(500).json({
        message: 'Lỗi khi thêm gallery',
        error: error.message,
      });
    }
  };
  
  // Cập nhật gallery
  const updateGallery = async (req, res) => {
    try {
      const { id_gallery } = req.params;
      const { name } = req.body;
  
      if (!id_gallery || isNaN(id_gallery)) {
        return res.status(400).json({
          message: 'id_gallery không hợp lệ, phải là một số',
        });
      }
  
      const gallery = await model.gallery.findOne({
        where: { id_gallery: parseInt(id_gallery) },
      });
      if (!gallery) {
        return res.status(404).json({
          message: 'Gallery không tồn tại',
        });
      }
  
      let updatedName = gallery.name;
      let imageUrls;
  
      // Kiểm tra và parse thumbnail
      if (gallery.thumbnail) {
        try {
          imageUrls = JSON.parse(gallery.thumbnail);
          // Đảm bảo imageUrls là mảng
          if (!Array.isArray(imageUrls)) {
            imageUrls = [imageUrls];
          }
        } catch (error) {
          console.log('Thumbnail không phải JSON, xử lý như URL đơn:', gallery.thumbnail);
          // Nếu không parse được, coi như thumbnail là một URL đơn
          imageUrls = [gallery.thumbnail];
        }
      } else {
        imageUrls = [];
      }
  
      // Cập nhật name nếu có
      if (name) {
        updatedName = name;
      }
  
      // Nếu có file mới, xóa ảnh cũ và upload ảnh mới
      if (req.files && req.files.length > 0) {
        // Xóa ảnh cũ trên Cloudinary
        for (const url of imageUrls) {
          const publicId = url.split('/').pop().split('.')[0];
          console.log('Xóa ảnh cũ trên Cloudinary:', `gallery/${publicId}`);
          await cloudinary.uploader.destroy(`gallery/${publicId}`);
        }
  
        // Upload ảnh mới
        imageUrls = [];
        for (const file of req.files) {
          console.log('Bắt đầu upload ảnh mới:', file.path);
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'gallery',
            resource_type: 'image',
          });
          console.log('Upload thành công:', result.secure_url);
          imageUrls.push(result.secure_url);
  
          console.log('Xóa file tạm:', file.path);
          await fs.unlink(file.path);
          console.log('Đã xóa file tạm thành công');
        }
      }
  
      // Cập nhật bản ghi
      await model.gallery.update(
        { name: updatedName, thumbnail: JSON.stringify(imageUrls) },
        { where: { id_gallery: parseInt(id_gallery) } }
      );
  
      const updatedGallery = await model.gallery.findOne({
        where: { id_gallery: parseInt(id_gallery) },
      });
  
      return res.status(200).json({
        message: 'Cập nhật gallery thành công',
        data: {
          id_gallery: updatedGallery.id_gallery,
          name: updatedGallery.name,
          thumbnails: JSON.parse(updatedGallery.thumbnail),
        },
      });
    } catch (error) {
      console.error('Error updating gallery:', error.message);
      if (req.files) {
        for (const file of req.files) {
          await fs.unlink(file.path).catch(err => console.error('Lỗi xóa file tạm:', err));
        }
      }
      return res.status(500).json({
        message: 'Lỗi khi cập nhật gallery',
        error: error.message,
      });
    }
  };
  
  // Xóa gallery
  const deleteGallery = async (req, res) => {
    try {
      const { id_gallery } = req.params;
  
      if (!id_gallery || isNaN(id_gallery)) {
        return res.status(400).json({
          message: 'id_gallery không hợp lệ, phải là một số',
        });
      }
  
      const gallery = await model.gallery.findOne({
        where: { id_gallery: parseInt(id_gallery) },
      });
      if (!gallery) {
        return res.status(404).json({
          message: 'Gallery không tồn tại',
        });
      }
  
      // Xử lý thumbnail
      let imageUrls = [];
      if (gallery.thumbnail) {
        try {
          imageUrls = JSON.parse(gallery.thumbnail);
          if (!Array.isArray(imageUrls)) {
            imageUrls = [imageUrls];
          }
        } catch (error) {
          console.log('Thumbnail không phải JSON, xử lý như URL đơn:', gallery.thumbnail);
          imageUrls = [gallery.thumbnail];
        }
      }
  
      // Xóa ảnh trên Cloudinary
      for (const url of imageUrls) {
        const publicId = url.split('/').pop().split('.')[0];
        console.log('Xóa ảnh trên Cloudinary:', `gallery/${publicId}`);
        await cloudinary.uploader.destroy(`gallery/${publicId}`);
      }
  
      // Xóa bản ghi
      await model.gallery.destroy({
        where: { id_gallery: parseInt(id_gallery) },
      });
  
      return res.status(200).json({
        message: 'Xóa gallery thành công',
      });
    } catch (error) {
      console.error('Error deleting gallery:', error.message);
      return res.status(500).json({
        message: 'Lỗi khi xóa gallery',
        error: error.message,
      });
    }
  };
  
  // Lấy gallery
  const getGallery = async (req, res) => {
    try {
      const { id_gallery } = req.params;
  
      if (id_gallery) {
        if (isNaN(id_gallery)) {
          return res.status(400).json({
            message: 'id_gallery không hợp lệ, phải là một số',
          });
        }
  
        const gallery = await model.gallery.findOne({
          where: { id_gallery: parseInt(id_gallery) },
        });
  
        if (!gallery) {
          return res.status(404).json({
            message: 'Gallery không tồn tại',
          });
        }
  
        let thumbnails = [];
        if (gallery.thumbnail) {
          try {
            thumbnails = JSON.parse(gallery.thumbnail);
            if (!Array.isArray(thumbnails)) {
              thumbnails = [thumbnails];
            }
          } catch (error) {
            console.log('Thumbnail không phải JSON, xử lý như URL đơn:', gallery.thumbnail);
            thumbnails = [gallery.thumbnail];
          }
        }
  
        return res.status(200).json({
          message: 'Lấy gallery thành công',
          data: {
            id_gallery: gallery.id_gallery,
            name: gallery.name,
            thumbnails: thumbnails,
          },
        });
      } else {
        const galleries = await model.gallery.findAll();
  
        const galleriesWithThumbnails = galleries.map(gallery => {
          let thumbnails = [];
          if (gallery.thumbnail) {
            try {
              thumbnails = JSON.parse(gallery.thumbnail);
              if (!Array.isArray(thumbnails)) {
                thumbnails = [thumbnails];
              }
            } catch (error) {
              console.log('Thumbnail không phải JSON, xử lý như URL đơn:', gallery.thumbnail);
              thumbnails = [gallery.thumbnail];
            }
          }
          return {
            id_gallery: gallery.id_gallery,
            name: gallery.name,
            thumbnails: thumbnails,
          };
        });
  
        return res.status(200).json({
          message: 'Lấy danh sách gallery thành công',
          data: galleriesWithThumbnails,
        });
      }
    } catch (error) {
      console.error('Error getting gallery:', error.message);
      return res.status(500).json({
        message: 'Lỗi khi lấy gallery',
        error: error.message,
      });
    }
  };
export { insertGallery, updateGallery, deleteGallery, getGallery };
