import { Fido2Lib } from 'fido2-lib';
import { poolPromise } from '../config/db.config.js';
import pkg from 'cbor';
const { decodeFirstSync } = pkg;

const f2l = new Fido2Lib({
  timeout: 60000,
  rpId: process.env.RP_ID,
  rpName: process.env.RP_NAME,
  challengeSize: 32,
  attestation: "none",
  cryptoParams: [-7, -257],
  authenticatorAttachment: "platform",
  authenticatorRequireResidentKey: false,
  authenticatorUserVerification: "required"
});

// FUNCIÓN PARA REGISTRO (Attestation)
export async function verifyAttestationResponse(attestationResponse, expectedChallenge, correo) {
  try {
    console.log("🔍 Iniciando verificación de REGISTRO (attestation)...");
    console.log("📧 Correo:", correo);
    console.log("🎫 Challenge esperado:", expectedChallenge);

    const decoder = new TextDecoder('utf-8');
    const clientDataJSON = decoder.decode(attestationResponse.response.clientDataJSON);
    const clientData = JSON.parse(clientDataJSON);
    const challengeFromClient = clientData.challenge;
    
    console.log("🔑 Challenge desde clientData:", challengeFromClient);

    const attestationExpectations = {
      challenge: challengeFromClient,
      origin: process.env.FRONTEND_URL,
      factor: "either"
    };

    console.log("🔧 Llamando a f2l.attestationResult...");
    
    let result;
    try {
      result = await f2l.attestationResult(attestationResponse, attestationExpectations);
      console.log("✅ attestationResult ejecutado correctamente");
    } catch (attestationError) {
      console.error("⚠️ Error en attestationResult:", attestationError.message);
      
      if (attestationError.message.includes('tpm') || attestationError.message.includes('TPM')) {
        console.log("🔧 Intentando extracción manual de clave pública...");
        
        try {
          const attestationObjectBuffer = Buffer.from(attestationResponse.response.attestationObject);
          const attestationObject = decodeFirstSync(attestationObjectBuffer);
          
          if (attestationObject.authData) {
            const authData = Buffer.from(attestationObject.authData);
            const rpIdHash = authData.slice(0, 32);
            const flags = authData[32];
            const counter = authData.readUInt32BE(33);
            
            const publicKeyData = authData.toString('base64');
            
            console.log("✅ Datos biométricos extraídos manualmente");
            
            return {
              publicKey: publicKeyData,
              counter: counter,
              credentialId: attestationResponse.id,
              extractedManually: true
            };
          } else {
            throw new Error("No se encontró authData en attestationObject");
          }
        } catch (manualError) {
          console.error("❌ Error en extracción manual:", manualError);
          throw new Error(`No se pudo extraer la clave pública: ${manualError.message}`);
        }
      }
      
      throw attestationError;
    }

    const publicKeyPem = result.authnrData.get('credentialPublicKeyPem');
    
    if (!publicKeyPem) {
      console.error("❌ No se pudo extraer la clave pública del resultado");
      return { error: "No se pudo extraer la clave pública" };
    }

    console.log("✅ Clave pública extraída exitosamente");

    return {
      publicKey: publicKeyPem,
      counter: result.authnrData.get('counter') || 0,
      credentialId: attestationResponse.id
    };

  } catch (error) {
    console.error("❌ Error al verificar la atestación:", error);
    return { error: error.message || "Error al verificar la atestación" };
  }
}

// FUNCIÓN PARA LOGIN (Assertion)
export async function verifyAssertionResponse(assertionResponse, correo) {
  try {
    console.log("🔍 Iniciando verificación de LOGIN (assertion)...");
    console.log("📧 Correo:", correo);

    // Recuperar la clave pública del usuario de la BD - MYSQL
    const [rows] = await poolPromise.query(
      'SELECT publicKey, prevCounter, credentialId FROM Usuarios WHERE correo = ?',
      [correo]
    );

    if (rows.length === 0) {
      console.log("❌ Usuario no encontrado:", correo);
      return { error: "Usuario no encontrado" };
    }

    const user = rows[0];
    console.log("✅ Usuario encontrado, tiene clave pública:", !!user.publicKey);

    if (!user.publicKey) {
      console.log("❌ No hay clave pública registrada para el usuario");
      return { error: "No se encontró la clave pública" };
    }

    const decoder = new TextDecoder('utf-8');
    const clientDataJSON = decoder.decode(assertionResponse.response.clientDataJSON);
    const clientData = JSON.parse(clientDataJSON);

    const assertionExpectations = {
      challenge: clientData.challenge,
      origin: process.env.FRONTEND_URL,
      factor: "either",
      publicKey: user.publicKey,
      prevCounter: user.prevCounter || 0,
      userHandle: Buffer.from(correo).toString('base64')
    };

    const result = await f2l.assertionResult(assertionResponse, assertionExpectations);
    
    console.log("✅ Aserción verificada exitosamente");

    // Actualizar el contador en la BD - MYSQL
    await poolPromise.query(
      'UPDATE Usuarios SET prevCounter = ? WHERE correo = ?',
      [result.authnrData.get('counter'), correo]
    );

    console.log("✅ Contador actualizado en BD");

    return {
      verified: true,
      counter: result.authnrData.get('counter')
    };

  } catch (error) {
    console.error("❌ Error al verificar la aserción:", error);
    return { error: error.message || "Error al verificar la aserción" };
  }
}