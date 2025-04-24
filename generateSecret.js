import { randomBytes } from "crypto";

// Tạo chuỗi ngẫu nhiên 32 byte và mã hóa dưới dạng base64
const secret = randomBytes(32).toString("base64");
console.log(secret);

// Tạo thêm một chuỗi nữa
const secret2 = randomBytes(32).toString("base64");
console.log(secret2);