import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import session from 'express-session';
import passport from './services/oauth.service.js';
import './config/db.config.js'; 

import authRoutes from './routes/auth.routes.js';
import oauthRoutes from './routes/oauth.routes.js';
import webauthnRoutes from './routes/webauthn.routes.js';
import smsRoutes from './routes/sms.routes.js';
import testRoutes from "./routes/test.routes.js";


dotenv.config();
const app = express();

// 🧠 1️⃣ Confianza en el proxy (obligatorio en Vercel)
app.set('trust proxy', true);

// 🧩 2️⃣ Middlewares básicos
app.use(express.json());

// 🛡️ 3️⃣ Helmet configurado para compatibilidad Vercel
app.use(
  helmet({
    xPoweredBy: false,
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
    hsts: false,
  })
);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // permite Postman, etc.
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS no permitido para este dominio: ' + origin), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));


// 💾 5️⃣ Sesiones (solo para OAuth)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
  })
);

// 🔑 6️⃣ Passport (OAuth2)
app.use(passport.initialize());
app.use(passport.session());

// 🚦 7️⃣ Rate Limiter personalizado para Vercel
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const forwarded = req.headers["x-forwarded-for"];
    const ip = forwarded ? forwarded.split(",")[0].trim() : req.ip;
    return ipKeyGenerator(ip); // ✅ usa el helper oficial para IPv6
  },
  message: "⚠️ Demasiadas peticiones desde esta IP. Intenta más tarde.",
});
app.use(limiter);

// 🌐 8️⃣ Rutas
app.get('/', (req, res) => {
  res.send('🚀 API funcionando correctamente en entorno de producción');
});

// Evitar timeout al pedir favicon.ico
app.get('/favicon.ico', (req, res) => res.status(204).end());


app.use('/api/auth', authRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/webauthn', webauthnRoutes);
app.use('/api/sms', smsRoutes);

app.use("/api", testRoutes);

export default app;
