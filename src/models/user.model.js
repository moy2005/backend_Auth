import mysql from "mysql2/promise";

export const UserModel = {
  create: async (pool, data) => {
    const { nombre, apaterno, amaterno, correo, telefono, contrasenaHash, metodo, proveedor } = data;

    await pool.execute(
      `INSERT INTO Usuarios (nombre, a_paterno, a_materno, correo, telefono, contrasena, metodo_autenticacion, proveedor_oauth)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, apaterno, amaterno, correo, telefono, contrasenaHash, metodo, proveedor]
    );
  },

  findByEmail: async (pool, correo) => {
    const [rows] = await pool.execute(
      'SELECT * FROM Usuarios WHERE correo = ?',
      [correo]
    );
    return rows[0];
  },
};