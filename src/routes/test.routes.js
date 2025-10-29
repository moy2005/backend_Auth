import express from "express";
import { poolPromise } from "../config/db.config.js";

const router = express.Router();

router.get("/test-db", async (req, res) => {
  try {
    const [rows] = await poolPromise.query("SELECT NOW() AS fecha;");
    res.json({
      message: "✅ Conexión activa con la base de datos",
      fechaServidor: rows[0].fecha,
    });
  } catch (error) {
    res.status(500).json({
      message: "❌ Error al consultar la base de datos",
      error: error.message,
    });
  }
});

export default router;
