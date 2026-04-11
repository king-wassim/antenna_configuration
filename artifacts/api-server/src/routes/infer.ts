import { Router, type IRouter } from "express";
import { spawn } from "child_process";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// __dirname in built bundle = dist/
// Go up 3 levels from dist/ → workspace/
const MODEL_PATH = path.resolve(__dirname, "../../../attached_assets/antenna_config_model_35_1775864227285.pth");
// infer.py lives in src/lib/; from dist/ go up one level to api-server/
const INFER_SCRIPT = path.resolve(__dirname, "../src/lib/infer.py");

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are accepted"));
    }
  },
});

const router: IRouter = Router();

router.post(
  "/predict-from-image",
  upload.single("image"),
  async (req, res): Promise<void> => {
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No image file provided" });
      return;
    }

    if (!fs.existsSync(MODEL_PATH)) {
      fs.unlinkSync(file.path);
      res.status(500).json({ error: `Model file not found: ${MODEL_PATH}` });
      return;
    }

    try {
      const result = await runPythonInference(file.path, MODEL_PATH);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Inference failed: ${message}` });
    } finally {
      fs.unlink(file.path, () => {});
    }
  }
);

function runPythonInference(
  imagePath: string,
  modelPath: string
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const py = spawn("python3", [INFER_SCRIPT, imagePath, modelPath]);

    let stdout = "";
    let stderr = "";

    py.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });

    py.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    py.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Python exited with code ${code}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.error) {
          reject(new Error(parsed.error));
        } else {
          resolve(parsed);
        }
      } catch {
        reject(new Error(`Invalid JSON from inference script: ${stdout}`));
      }
    });

    py.on("error", (err) => {
      reject(err);
    });
  });
}

export default router;
