import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export const TwilioService = {
  /**
   * Envía un mensaje SMS real usando Twilio.
   * @param {string} to - Número de destino (ej. +527711234567)
   * @param {string} body - Texto del mensaje
   */
  sendSMS: async (to, body) => {
    try {
    
      const message = await client.messages.create({
        body,
        from: process.env.TWILIO_PHONE_NUMBER,
        to,
      });

      return { success: true, sid: message.sid };
    } catch (error) {
      console.error("❌ Error al enviar SMS:", error.message);
      return { success: false, error: error.message };
    }
  },
};
