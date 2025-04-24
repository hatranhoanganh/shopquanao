import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'djk6mtfbz', // Thay bằng cloud_name của bạn
  api_key: '433121748345875', // Thay bằng api_key của bạn
  api_secret: '1PFzanBIrYa6BQE3ssazFC6VMbI', // Thay bằng api_secret của bạn
});

export default cloudinary;