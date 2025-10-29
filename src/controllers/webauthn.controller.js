import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { poolPromise } from "../config/db.config.js";
import { verifyAttestationResponse, verifyAssertionResponse } from "../services/webauthn.service.js";

export class WebAuthnController {
  // -------------------------------
  // REGISTRO COMPLETO (Usuario + Biometría)
  // -------------------------------
  static async registerBiometric(req, res) {
    const connection = await poolPromise.getConnection();
    
    try {
      const { nombre, apaterno, amaterno, correo, telefono, contrasena, biometria } = req.body;

      console.log("🔍 Iniciando registro con biometría...");
      console.log("📧 Correo:", correo);
      console.log("🔐 Tipo biométrico:", biometria?.tipo);

      if (!nombre || !apaterno || !amaterno || !correo || !telefono || !contrasena) {
        return res.status(400).json({ error: "Faltan datos del usuario" });
      }
      if (!biometria || !biometria.tipo || !biometria.credentialData) {
        return res.status(400).json({ error: "Faltan datos biométricos" });
      }

      await connection.beginTransaction();

      // 1. Verificar correo
      const [existingUsers] = await connection.query(
        'SELECT id_usuario FROM Usuarios WHERE correo = ?',
        [correo]
      );

      if (existingUsers.length > 0) {
        await connection.rollback();
        return res.status(400).json({ error: "El correo ya está registrado" });
      }

      // 2. Crear usuario
      const hashedPassword = await bcrypt.hash(contrasena, 10);
      await connection.query(
        `INSERT INTO Usuarios (nombre, a_paterno, a_materno, correo, telefono, contrasena)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [nombre, apaterno, amaterno, correo, telefono, hashedPassword]
      );

      // 3. Procesar biometría
      const { tipo, challenge, credentialData } = biometria;
      const base64ToBuffer = (b64) => Buffer.from(b64, "base64");
      const bufferToArrayBuffer = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      
      const attestationData = {
        id: credentialData.id,
        rawId: bufferToArrayBuffer(base64ToBuffer(credentialData.rawId)),
        type: credentialData.type,
        response: {
          clientDataJSON: bufferToArrayBuffer(base64ToBuffer(credentialData.response.clientDataJSON)),
          attestationObject: bufferToArrayBuffer(base64ToBuffer(credentialData.response.attestationObject)),
        },
      };

      const verifyResult = await verifyAttestationResponse(attestationData, challenge, correo);
      if (verifyResult.error) {
        await connection.rollback();
        return res.status(400).json({ error: verifyResult.error });
      }

      // 4. Guardar datos biométricos
      await connection.query(
        `UPDATE Usuarios
         SET publicKey = ?, credentialId = ?, huella_biometrica = ?, prevCounter = ?
         WHERE correo = ?`,
        [verifyResult.publicKey, credentialData.id, tipo, verifyResult.counter || 0, correo]
      );

      await connection.commit();
      res.json({ success: true, message: "Usuario registrado con biometría exitosamente" });
    } catch (error) {
      await connection.rollback();
      console.error("❌ Error en registerBiometric:", error);
      res.status(500).json({ error: "Error en el registro", details: error.message });
    } finally {
      connection.release();
    }
  }

  // -------------------------------
  // OPCIONES DE REGISTRO
  // -------------------------------
  static registerOptions(req, res) {
    try {
      const { correo, tipo } = req.body;
      const challenge = crypto.randomBytes(32).toString("base64");

      const options = {
        challenge,
        rp: { name: process.env.RP_NAME, id: process.env.RP_ID },
        user: {
          id: Buffer.from(correo).toString("base64"),
          name: correo,
          displayName: correo,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        timeout: 60000,
        authenticatorSelection: {
          authenticatorAttachment: tipo === "HUELLA" ? "platform" : "cross-platform",
          residentKey: "preferred",
          userVerification: "required",
        },
        attestation: "none",
      };

      res.json(options);
    } catch (error) {
      res.status(500).json({ error: "Error al generar opciones WebAuthn" });
    }
  }

  // -------------------------------
  // VERIFICAR REGISTRO
  // -------------------------------
  static async registerVerify(req, res) {
    try {
      const { correo, tipo, challenge, credentialData } = req.body;
      const base64ToBuffer = (b64) => Buffer.from(b64, "base64");
      const bufferToArrayBuffer = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

      const attestationData = {
        id: credentialData.id,
        rawId: bufferToArrayBuffer(base64ToBuffer(credentialData.rawId)),
        type: credentialData.type,
        response: {
          clientDataJSON: bufferToArrayBuffer(base64ToBuffer(credentialData.response.clientDataJSON)),
          attestationObject: bufferToArrayBuffer(base64ToBuffer(credentialData.response.attestationObject)),
        },
      };

      const result = await verifyAttestationResponse(attestationData, challenge, correo);
      if (result.error) return res.status(400).json({ error: result.error });

      const [updateResult] = await poolPromise.query(
        `UPDATE Usuarios
         SET publicKey = ?, credentialId = ?, huella_biometrica = ?, prevCounter = ?
         WHERE correo = ?`,
        [result.publicKey, credentialData.id, tipo, result.counter || 0, correo]
      );

      if (updateResult.affectedRows === 0)
        return res.status(404).json({ error: "Usuario no encontrado" });

      res.json({ success: true, message: "Biometría registrada correctamente" });
    } catch (error) {
      res.status(500).json({ error: "Error al verificar la autenticación biométrica", details: error.message });
    }
  }

  // -------------------------------
  // OBTENER TIPO DE BIOMETRÍA
  // -------------------------------
  static async getTipo(req, res) {
    try {
      const { correo } = req.params;
      const [rows] = await poolPromise.query(
        'SELECT huella_biometrica AS metodo FROM Usuarios WHERE correo = ?',
        [correo]
      );

      if (rows.length === 0)
        return res.status(404).json({ error: "Usuario no encontrado o sin biometría" });

      res.json({ metodo: rows[0].metodo });
    } catch (error) {
      res.status(500).json({ error: "Error al obtener tipo de biometría", details: error.message });
    }
  }

  // -------------------------------
  // OPCIONES DE AUTENTICACIÓN (LOGIN)
  // -------------------------------
  static async authOptions(req, res) {
    try {
      const { correo } = req.body;
      const [rows] = await poolPromise.query(
        'SELECT credentialId, huella_biometrica FROM Usuarios WHERE correo = ?',
        [correo]
      );

      if (rows.length === 0)
        return res.status(404).json({ error: "Usuario no encontrado" });

      const user = rows[0];
      const challenge = crypto.randomBytes(32).toString("base64");

      const options = {
        challenge,
        timeout: 60000,
        rpId: process.env.RP_ID,
        allowCredentials: [
          { type: "public-key", id: user.credentialId, transports: ["internal"] },
        ],
        userVerification: "required",
      };

      res.json(options);
    } catch (error) {
      res.status(500).json({ error: "Error al generar opciones de autenticación" });
    }
  }

  // -------------------------------
  // VERIFICAR AUTENTICACIÓN (LOGIN)
  // -------------------------------
  static async authVerify(req, res) {
    try {
      const { correo, assertionResponse } = req.body;
      const base64ToBuffer = (b64) => Buffer.from(b64, "base64");
      const bufferToArrayBuffer = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

      const assertionData = {
        id: assertionResponse.id,
        rawId: bufferToArrayBuffer(base64ToBuffer(assertionResponse.rawId)),
        type: "public-key",
        response: {
          clientDataJSON: bufferToArrayBuffer(base64ToBuffer(assertionResponse.response.clientDataJSON)),
          authenticatorData: bufferToArrayBuffer(base64ToBuffer(assertionResponse.response.authenticatorData)),
          signature: bufferToArrayBuffer(base64ToBuffer(assertionResponse.response.signature)),
          userHandle: assertionResponse.response.userHandle
            ? bufferToArrayBuffer(base64ToBuffer(assertionResponse.response.userHandle))
            : null,
        },
      };

      const result = await verifyAssertionResponse(assertionData, correo);
      if (result.error) return res.status(400).json({ error: result.error });

      const [rows] = await poolPromise.query(
        'SELECT * FROM Usuarios WHERE correo = ?',
        [correo]
      );

      if (rows.length === 0)
        return res.status(404).json({ error: "Usuario no encontrado" });

      const user = rows[0];
      
      // ✅ INCLUIR TODOS LOS DATOS EN EL TOKEN
      const token = jwt.sign(
        { 
          id_usuario: user.id_usuario,
          id: user.id_usuario,
          correo: user.correo,
          nombre: user.nombre,
          a_paterno: user.a_paterno,
          a_materno: user.a_materno,
          telefono: user.telefono,
          metodo_autenticacion: "Biometría",
          authMethod: "biometric"
        },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      // ✅ DEVOLVER DATOS COMPLETOS DEL USUARIO
      res.json({
        success: true,
        token,
        accessToken: token,
        user: { 
          id_usuario: user.id_usuario,
          nombre: user.nombre,
          a_paterno: user.a_paterno,
          a_materno: user.a_materno,
          correo: user.correo,
          telefono: user.telefono,
          metodo_autenticacion: "Biometría",
          estado: user.estado || "Activo"
        },
        message: "Autenticación biométrica exitosa",
      });
    } catch (error) {
      console.error("❌ Error en authVerify:", error);
      res.status(500).json({ error: "Error al verificar autenticación biométrica", details: error.message });
    }
  }
}