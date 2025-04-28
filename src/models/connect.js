import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config(); // Đọc file .env

const sequelize = new Sequelize(
  process.env.DB_NAME, // Tên database
  process.env.DB_USER, // Tên user
  process.env.DB_PASSWORD, // Password
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306, // Mặc định cổng 3306 nếu không có
    dialect: process.env.DB_DIALECT,
  }
);

export default sequelize;
