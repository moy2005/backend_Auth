import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Configuración del pool de conexiones MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Exportar el pool para usar en los modelos
export const poolPromise = pool;

// Verificar conexión
pool.getConnection()
  .then(connection => {
    console.log('✅ Conexión exitosa a MySQL');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Error al conectar a MySQL:', err);
  });

export default pool;