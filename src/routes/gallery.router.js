import express from "express";
import upload from "../utils/multer.js";
import {
  insertGallery,
  updateGallery,
  deleteGallery,
  getGalleryByKeyword,
} from "../controllers/gallery.controller.js";
import { getPaginatedData } from "../controllers/pagination.controller.js";

const galleryRoutes = express.Router();


galleryRoutes.post("/ThemGallery", upload.array("thumbnail"), insertGallery);
galleryRoutes.put("/CapNhatGallery/:id_gallery", upload.array("thumbnail"), updateGallery);
galleryRoutes.delete("/XoaGallery/:id_gallery", deleteGallery);
galleryRoutes.get("/LayGalleryTheoMaHoacTen/:keyword", getGalleryByKeyword);


galleryRoutes.get("/LayDanhSachGallery", (req, res) => {
  res.locals.type = "galleries";
  getPaginatedData(req, res);
});

export default galleryRoutes;