import mysql from "mysql2/promise";
import bcrypt from 'bcryptjs';

export const SessionModel = {
  /**
   * Guarda una nueva sesión JWT
   */
  save: async (pool, id_usuario, jwtToken, ip) => {
    try {
      const jwtHash = await bcrypt.hash(jwtToken, 12);
      await pool.execute(
        `INSERT INTO SesionesJWT (id_usuario, jwt_token, fecha_inicio, ip_origen)
         VALUES (?, ?, NOW(), ?)`,
        [id_usuario, jwtHash, ip]
      );
    } catch (err) {
      console.error('❌ Error al guardar sesión JWT:', err);
    }
  },

  /**
   * Valida si el JWT sigue activo (no expirado ni cerrado)
   */
  validate: async (pool, id_usuario, jwtToken) => {
    const [rows] = await pool.execute(
      `SELECT jwt_token, fecha_cierre
       FROM SesionesJWT
       WHERE id_usuario = ?
       ORDER BY fecha_inicio DESC
       LIMIT 1`,
      [id_usuario]
    );

    if (!rows.length) return false;

    const session = rows[0];
    if (session.fecha_cierre) return false; // sesión cerrada
    return await bcrypt.compare(jwtToken, session.jwt_token);
  },
};