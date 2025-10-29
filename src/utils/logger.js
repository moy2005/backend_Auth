import fs from "fs";
import path from "path";

// 🧩 Determina el archivo de logs
const logFile = path.resolve("./logs.txt");

// 🧠 Función para registrar mensajes con fecha
export function logMessage(message) {
  const timestamp = new Date().toISOString();
  const formatted = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFile, formatted);
  console.log(formatted.trim());
}
