import multer from "multer";
import path from "path";
import fs from "fs";

const UPLOAD_BASE = path.join(process.cwd(), "uploads", "kyc");

// Ensure base upload directory exists
fs.mkdirSync(UPLOAD_BASE, { recursive: true });

export const kycUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      // Store under uploads/kyc/:caseId/
      const caseId = req.params.id ?? "unknown";
      const caseDir = path.join(UPLOAD_BASE, caseId);
      fs.mkdirSync(caseDir, { recursive: true });
      cb(null, caseDir);
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${unique}${ext}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP, and PDF files are allowed"));
    }
  },
});
