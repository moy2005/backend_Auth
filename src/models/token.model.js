import mysql from "mysql2/promise";

export const TokenModel = {
  save: async (pool, id_usuario, codigo_otp, tipo, fecha_expiracion = null) => {
    // Si no se pasa fecha_expiracion, se calcula por defecto (+1 min)
    const expiracionFinal = fecha_expiracion || new Date(Date.now() + 60 * 1000);

    await pool.execute(
      `INSERT INTO Tokens2FA (id_usuario, codigo_otp, fecha_emision, fecha_expiracion, tipo, estado)
       VALUES (?, ?, NOW(), ?, ?, 'Activo')`,
      [id_usuario, codigo_otp, expiracionFinal, tipo]
    );
  },

  findLatest: async (pool, id_usuario) => {
    const [rows] = await pool.execute(
      `SELECT * FROM Tokens2FA
       WHERE id_usuario = ? AND estado = 'Activo'
       ORDER BY fecha_emision DESC
       LIMIT 1`,
      [id_usuario]
    );
    return rows[0];
  },
};