import express from 'express';
import upload from '../utils/multer.js'; // Nếu utils nằm trong src/
import {
    insertGallery,
    updateGallery,
    deleteGallery,
    getGallery,
} from "../controllers/gallery.controller.js";
import { authMiddleware, adminMiddleware } from "../middleware/authMiddleware.js"; // Thêm authMiddleware, adminMiddleware

const galleryRoutes = express.Router();

// Áp dụng authMiddleware và adminMiddleware cho tất cả các route
galleryRoutes.post('/InsertGallery', authMiddleware, adminMiddleware, upload.array('thumbnail'), insertGallery);
galleryRoutes.put('/UpdateGallery/:id_gallery', authMiddleware, adminMiddleware, upload.array('thumbnail'), updateGallery);
galleryRoutes.delete('/DeleteGallery/:id_gallery', authMiddleware, adminMiddleware, deleteGallery);
galleryRoutes.get('/GetGallery/:id_gallery', authMiddleware, getGallery); 
galleryRoutes.get('/GetGallery', authMiddleware, getGallery);

export default galleryRoutes;