import category from "../models/gallery.js";
import sequelize from "../models/connect.js";
import initModels from "../models/init-models.js";
import cloudinary from "../config/cloudinary.js";
import { promises as fs } from "fs";
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
      return res.status(400).json({ message: "Vui lòng cung cấp tên gallery" });
    }

    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ message: "Vui lòng upload ít nhất một ảnh" });
    }

    // Upload từng ảnh lên Cloudinary và lưu URL vào mảng
    const imageUrls = [];
    for (const file of req.files) {
      console.log("Bắt đầu upload ảnh lên Cloudinary:", file.path);
      const result = await cloudinary.uploader.upload(file.path, {
        folder: "gallery",
        resource_type: "image",
      });
      console.log("Upload thành công:", result.secure_url);
      imageUrls.push(result.secure_url);

      // Xóa file tạm
      console.log("Xóa file tạm:", file.path);
      await fs.unlink(file.path);
      console.log("Đã xóa file tạm thành công");
    }

    // Tạo bản ghi gallery với danh sách URL ảnh dưới dạng JSON
    const newGallery = await model.gallery.create({
      name: name,
      thumbnail: JSON.stringify(imageUrls),
    });

    return res.status(201).json({
      message: "Thêm gallery thành công",
      data: {
        id_gallery: newGallery.id_gallery,
        name: newGallery.name,
        thumbnails: JSON.parse(newGallery.thumbnail), // Parse JSON để trả về mảng
      },
    });
  } catch (error) {
    console.error("Error inserting gallery:", error);
    if (req.files) {
      for (const file of req.files) {
        await fs
          .unlink(file.path)
          .catch((err) => console.error("Lỗi xóa file tạm:", err));
      }
    }
    return res.status(500).json({
      message: "Lỗi khi thêm gallery",
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
        message: "id_gallery không hợp lệ, phải là một số",
      });
    }

    const gallery = await model.gallery.findOne({
      where: { id_gallery: parseInt(id_gallery) },
    });
    if (!gallery) {
      return res.status(404).json({
        message: "Gallery không tồn tại",
      });
    }

    let updatedName = gallery.name;
    let imageUrls = [];

    // Kiểm tra và parse thumbnail
    if (gallery.thumbnail) {
      try {
        imageUrls = JSON.parse(gallery.thumbnail);
        if (!Array.isArray(imageUrls)) {
          imageUrls = [imageUrls];
        }
      } catch (error) {
        console.log(
          "Thumbnail không phải JSON, xử lý như URL đơn:",
          gallery.thumbnail
        );
        imageUrls = [gallery.thumbnail];
      }
    }

    // Cập nhật name nếu có
    if (name) {
      updatedName = name;
    }

    // Nếu có file mới, xử lý upload và xóa ảnh cũ
    if (req.files && req.files.length > 0) {
      try {
        // Xóa ảnh cũ trên Cloudinary
        if (imageUrls.length > 0) {
          for (const url of imageUrls) {
            const publicId = url.split("/").pop().split(".")[0];
            console.log("Xóa ảnh cũ trên Cloudinary:", `gallery/${publicId}`);
            await cloudinary.uploader
              .destroy(`gallery/${publicId}`)
              .catch((err) => console.log("Lỗi xóa ảnh cũ:", err));
          }
        }

        // Upload ảnh mới
        imageUrls = [];
        for (const file of req.files) {
          console.log("Bắt đầu upload ảnh mới:", file.path);
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "gallery",
            resource_type: "image",
          });
          console.log("Upload thành công:", result.secure_url);
          imageUrls.push(result.secure_url);
        }
      } catch (uploadError) {
        console.error("Lỗi khi upload/xóa ảnh:", uploadError.message);
        return res.status(500).json({
          message: "Lỗi khi xử lý ảnh",
          error: uploadError.message,
        });
      }

      // Xóa file tạm sau khi upload thành công
      try {
        for (const file of req.files) {
          await fs
            .unlink(file.path)
            .catch((err) => console.log("Lỗi xóa file tạm:", err));
        }
      } catch (cleanupError) {
        console.error("Lỗi khi dọn dẹp file tạm:", cleanupError.message);
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
      message: "Cập nhật gallery thành công",
      data: {
        id_gallery: updatedGallery.id_gallery,
        name: updatedGallery.name,
        thumbnails: JSON.parse(updatedGallery.thumbnail),
      },
    });
  } catch (error) {
    console.error("Error updating gallery:", error.message);
    if (req.files) {
      for (const file of req.files) {
        await fs
          .unlink(file.path)
          .catch((err) => console.error("Lỗi xóa file tạm:", err));
      }
    }
    return res.status(500).json({
      message: "Lỗi khi cập nhật gallery",
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
        message: "id_gallery không hợp lệ, phải là một số",
      });
    }

    const gallery = await model.gallery.findOne({
      where: { id_gallery: parseInt(id_gallery) },
    });
    if (!gallery) {
      return res.status(404).json({
        message: "Gallery không tồn tại",
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
        console.log(
          "Thumbnail không phải JSON, xử lý như URL đơn:",
          gallery.thumbnail
        );
        imageUrls = [gallery.thumbnail];
      }
    }

    // Xóa ảnh trên Cloudinary
    for (const url of imageUrls) {
      const publicId = url.split("/").pop().split(".")[0];
      console.log("Xóa ảnh trên Cloudinary:", `gallery/${publicId}`);
      await cloudinary.uploader.destroy(`gallery/${publicId}`);
    }

    // Xóa bản ghi
    await model.gallery.destroy({
      where: { id_gallery: parseInt(id_gallery) },
    });

    return res.status(200).json({
      message: "Xóa gallery thành công",
    });
  } catch (error) {
    console.error("Error deleting gallery:", error.message);
    return res.status(500).json({
      message: "Lỗi khi xóa gallery",
      error: error.message,
    });
  }
};

// Lấy gallery theo keyword (mã hoặc tên)
const getGalleryByKeyword = async (req, res) => {
  try {
    const { keyword } = req.params;
    const { keyword: queryKeyword } = req.query;

    // Lấy keyword từ path hoặc query, ưu tiên path
    const searchKeyword = keyword || queryKeyword;

    if (!searchKeyword) {
      return res.status(400).json({
        message: "Vui lòng cung cấp keyword (mã hoặc tên gallery)",
      });
    }

    let whereClause = {};
    // Nếu keyword là số, tìm theo id_gallery
    if (!isNaN(searchKeyword)) {
      whereClause.id_gallery = parseInt(searchKeyword);
    } else {
      // Nếu keyword không phải số, tìm theo name
      whereClause.name = { [Op.like]: `%${searchKeyword}%` };
    }

    const galleries = await model.gallery.findAll({
      where: whereClause,
      attributes: ["id_gallery", "name", "thumbnail"],
    });

    if (galleries.length === 0) {
      return res.status(404).json({
        message: "Gallery không tồn tại",
      });
    }

    const data = galleries.map((gallery) => {
      const galleryData = gallery.toJSON();
      if (galleryData.thumbnail) {
        try {
          galleryData.thumbnail = JSON.parse(galleryData.thumbnail);
        } catch (error) {
          console.error("Lỗi parse thumbnail:", error.message);
          galleryData.thumbnail = [];
        }
      } else {
        galleryData.thumbnail = [];
      }
      return galleryData;
    });

    return res.status(200).json({
      message: "Lấy thông tin gallery thành công",
      data,
    });
  } catch (error) {
    console.error("Lỗi khi lấy gallery:", error.message);
    return res.status(500).json({
      message: "Lỗi khi lấy gallery",
      error: error.message,
    });
  }
};

export { insertGallery, updateGallery, deleteGallery,getGalleryByKeyword, };
