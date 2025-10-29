import { JWTService } from "../services/jwt.service.js";
import { SessionModel } from "../models/session.model.js";
import { poolPromise } from "../config/db.config.js";
import crypto from "crypto";

export const OAuthController = {
  success: async (req, res) => {
    try {
      const user = req.user;
      const pool = await poolPromise;

      if (!user || !user.id_usuario) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=invalid_user`);
      }

      const accessToken = JWTService.generateToken({
        id: user.id_usuario,
        correo: user.correo,
      });
      const refreshToken = crypto.randomUUID();

      await SessionModel.save(pool, user.id_usuario, accessToken, req.ip);

      // Redirige al LOGIN (no dashboard)
      const redirectUrl = new URL(`${process.env.FRONTEND_URL}/login`);
      redirectUrl.searchParams.set("accessToken", accessToken);
      redirectUrl.searchParams.set("refreshToken", refreshToken);
      redirectUrl.searchParams.set("nombre", user.nombre || "");
      redirectUrl.searchParams.set("correo", user.correo || "");

      return res.redirect(redirectUrl.toString());
    } catch (err) {
      console.error("❌ Error en OAuth success:", err);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);

    }
  },

  failure: (req, res) => {
       return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_cancelled`);
  },
};
