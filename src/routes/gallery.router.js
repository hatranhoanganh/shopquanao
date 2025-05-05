import express from 'express';
import upload from '../utils/multer.js'; // Nếu utils nằm trong src/
import {
    insertGallery,
    updateGallery,
    deleteGallery,
    getGallery,
} from "../controllers/gallery.controller.js";


const galleryRoutes = express.Router();

// Áp dụng authMiddleware và adminMiddleware cho tất cả các route
galleryRoutes.post('/InsertGallery', upload.array('thumbnail'), insertGallery);
galleryRoutes.put('/UpdateGallery/:id_gallery', upload.array('thumbnail'), updateGallery);
galleryRoutes.delete('/DeleteGallery/:id_gallery', deleteGallery);
galleryRoutes.get('/GetGallery/:id_gallery', getGallery); 
galleryRoutes.get('/GetGallery', getGallery);

export default galleryRoutes;