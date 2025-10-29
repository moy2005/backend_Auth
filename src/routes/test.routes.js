import express from "express";
import { poolPromise } from "../config/db.config.js";

const router = express.Router();

router.get("/test-db", async (req, res) => {
  try {
    const [rows] = await poolPromise.query("SELECT NOW() AS fecha;");
    res.status(200).json({
      message: "✅ Conexión activa a FreeSQLDatabase desde Vercel",
      fechaServidor: rows[0].fecha,
    });
  } catch (err) {
    console.error("❌ Error al consultar la base de datos:", err.message);
    res.status(500).json({
      message: "❌ Error al conectar con la base de datos",
      error: err.message,
    });
  }
});

export default router;
