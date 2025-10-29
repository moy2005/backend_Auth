import app from '../src/app.js';
import serverless from 'serverless-http';

// Convierte tu app Express en una función compatible con Vercel
export const handler = serverless(app);

