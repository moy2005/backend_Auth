import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import passport from './services/oauth.service.js';

// Configuración de entorno y base de datos
import './config/db.config.js'; 

// Importación de rutas
import authRoutes from './routes/auth.routes.js';
import oauthRoutes from './routes/oauth.routes.js';
import webauthnRoutes from './routes/webauthn.routes.js';
import smsRoutes from './routes/sms.routes.js';

dotenv.config();
const app = express();

//  Middlewares globales
app.use(express.json());
app.use(
  helmet({
    // Desactiva la validación de cabeceras problemáticas con Vercel
    xPoweredBy: false,
    crossOriginOpenerPolicy: false,
    contentSecurityPolicy: false,
    hsts: false,
    crossOriginEmbedderPolicy: false,
    originAgentCluster: false,
  })
);


// 🧠 Configuración de CORS dinámica (segura para local + producción)
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Permite cookies o tokens en peticiones cross-domain
}));

//  Configuración de sesiones segura
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // solo HTTPS en prod
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

//  Inicialización de Passport (OAuth)
app.use(passport.initialize());
app.use(passport.session());

//  Límite de peticiones (protección DDoS y fuerza bruta)
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // máximo 100 requests/minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: '⚠️ Demasiadas peticiones desde esta IP. Intenta más tarde.',
});
app.use(limiter);

//  Ruta raíz (comprobación rápida)
app.get('/', (req, res) => {
  res.send('🚀 API funcionando correctamente en entorno de producción');
});

// Rutas del sistema
// 1. TOKEN + CONTRASEÑA
app.use('/api/auth', authRoutes);

// 2. OAUTH2 (GOOGLE, FACEBOOK)
app.use('/api/oauth', oauthRoutes);

// 3. WEBAUTHN (BIOMETRÍA)
app.use('/api/webauthn', webauthnRoutes);

// 4. SMS
app.use('/api/sms', smsRoutes);

export default app;
