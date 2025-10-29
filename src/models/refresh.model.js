import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

export const RefreshModel = {
  /**
   * Guarda o reemplaza un refresh token para un usuario.
   */
  save: async (pool, id_usuario, refreshToken, duracionDias = 7) => {
    const hash = await bcrypt.hash(refreshToken, 10);
    const exp = new Date(Date.now() + duracionDias * 24 * 60 * 60 * 1000);

    // Revoca tokens anteriores
    await pool.execute(
      "UPDATE TokensRefresh SET estado = 'Revocado' WHERE id_usuario = ?",
      [id_usuario]
    );

    // Guarda el nuevo
    await pool.execute(
      `INSERT INTO TokensRefresh (id_usuario, refresh_token, fecha_expiracion, estado)
       VALUES (?, ?, ?, 'Activo')`,
      [id_usuario, hash, exp]
    );
  },

  /**
   * Valida un refresh token recibido del cliente.
   */
  validate: async (pool, id_usuario, token) => {
    const [rows] = await pool.execute(
      `SELECT * FROM TokensRefresh
       WHERE id_usuario = ? AND estado = 'Activo'
       ORDER BY fecha_emision DESC
       LIMIT 1`,
      [id_usuario]
    );

    if (!rows.length) return false;

    const record = rows[0];
    const match = await bcrypt.compare(token, record.refresh_token);
    if (!match) return false;

    // Verificar expiración
    const now = new Date();
    if (now > new Date(record.fecha_expiracion)) return false;

    return true;
  },

  /**
   * Revoca un refresh token (por logout o rotación)
   */
  revoke: async (pool, id_usuario) => {
    await pool.execute(
      `UPDATE TokensRefresh
       SET estado = 'Revocado'
       WHERE id_usuario = ? AND estado = 'Activo'`,
      [id_usuario]
    );
  }
};