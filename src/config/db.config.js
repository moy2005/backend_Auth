import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 5,    
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10000,  
});

// Verificar conexión (una sola vez)
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Conexión exitosa a MySQL');
    conn.release();
  } catch (err) {
    console.error('❌ Error al conectar a MySQL:', err.message);
  }
})();

export default pool;
