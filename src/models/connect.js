import { Sequelize } from "sequelize";


const sequelize = new Sequelize(
  // configDb.database, //tên database
  // configDb.user, // ten user
  // configDb.pass, //password user
  // "khoa_hoc", //tên database
  // "root", // ten user
  // "123456", //password user
  "shopquanao", //tên database
  "root", // ten user
  "", //password user
  {
    host: "localhost",
    port: 3306,
    dialect: "mysql",
  }
);

export default sequelize;
