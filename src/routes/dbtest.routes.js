import express from "express";
import { poolPromise } from "../config/db.config.js";
import { logMessage } from "../utils/logger.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await poolPromise.query("SELECT * FROM Usuarios LIMIT 5");
    logMessage(`✅ Consulta exitosa: ${rows.length} registros obtenidos`);
    logMessage(JSON.stringify(rows, null, 2));
    res.json({ ok: true, total: rows.length, data: rows });
  } catch (err) {
    logMessage(`❌ Error en consulta: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
