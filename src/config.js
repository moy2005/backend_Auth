import dotenv from 'dotenv';
dotenv.config();

export default {
  db: {
    user: process.env.DB_USER,
    password: process.env.DB_PSSWD,
    server: process.env.DB_SERVER_IP,
    database: process.env.DB_NAME,
    options: {
      encrypt: false,  // Cambiado a false
      trustServerCertificate: true,
      enableArithAbort: true,
    },
  },
  port: process.env.PORT || 4000,
};