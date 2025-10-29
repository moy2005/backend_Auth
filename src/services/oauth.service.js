import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { poolPromise } from "../config/db.config.js";

// --- Estrategia GOOGLE ---
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const nombre = profile.displayName || "Usuario Google";
        const proveedor = "Google";

        if (!email) {
          return done(null, false, { 
            message: "Google no proporcionó un correo electrónico. Por favor, autoriza el permiso de email." 
          });
        }

        // Buscar usuario existente
        const [rows] = await poolPromise.query(
          'SELECT * FROM Usuarios WHERE correo = ?',
          [email]
        );

        let user;
        if (rows.length > 0) {
          // Usuario ya existe
          user = rows[0];
          if (!user.proveedor_oauth) {
            await poolPromise.query(
              'UPDATE Usuarios SET proveedor_oauth = ? WHERE correo = ?',
              [proveedor, email]
            );
            user.proveedor_oauth = proveedor;
          }
        } else {
          // Registrar nuevo usuario desde OAuth
          const [result] = await poolPromise.query(
            `INSERT INTO Usuarios (nombre, correo, telefono, contrasena, metodo_autenticacion, proveedor_oauth)
             VALUES (?, ?, NULL, 'OAUTH_NO_PASSWORD', 'OAuth', ?)`,
            [nombre, email, proveedor]
          );
          
          // Obtener el usuario recién creado
          const [newUser] = await poolPromise.query(
            'SELECT * FROM Usuarios WHERE id_usuario = ?',
            [result.insertId]
          );
          user = newUser[0];
        }

        return done(null, user);
      } catch (err) {
        console.error("❌ Error en Google OAuth:", err);
        done(err, null);
      }
    }
  )
);

// --- Estrategia FACEBOOK ---
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL,
      profileFields: ["id", "emails", "name", "displayName"],
      profileURL: "https://graph.facebook.com/v18.0/me?fields=id,name,email,first_name,last_name",
      enableProof: true
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
       
        
        const email = profile.emails?.[0]?.value || profile._json?.email;
        const nombre = profile.displayName || profile.name?.givenName || "Usuario Facebook";
        const proveedor = "Facebook";
        const facebookId = profile.id;

        // Si no hay email, crear cuenta temporal con Facebook ID
        if (!email) {
         
          const tempEmail = `facebook_${facebookId}@temp.oauth`;
          
          const [rows] = await poolPromise.query(
            'SELECT * FROM Usuarios WHERE correo = ?',
            [tempEmail]
          );

          let user;
          if (rows.length > 0) {
            user = rows[0];
            console.log("✅ Usuario existente encontrado:", user.nombre);
          } else {
            const [result] = await poolPromise.query(
              `INSERT INTO Usuarios (nombre, correo, telefono, contrasena, metodo_autenticacion, proveedor_oauth)
               VALUES (?, ?, ?, 'OAUTH_NO_PASSWORD', 'OAuth', ?)`,
              [nombre, tempEmail, `OAUTH_${Date.now()}`, proveedor]
            );
            
            const [newUser] = await poolPromise.query(
              'SELECT * FROM Usuarios WHERE id_usuario = ?',
              [result.insertId]
            );
            user = newUser[0];
            console.log("✅ Nuevo usuario creado con email temporal:", tempEmail);
          }
          
          return done(null, user);
        }

        // Si hay email, proceder normalmente
        const [rows] = await poolPromise.query(
          'SELECT * FROM Usuarios WHERE correo = ?',
          [email]
        );

        let user;
        if (rows.length > 0) {
          user = rows[0];
          if (!user.proveedor_oauth) {
            await poolPromise.query(
              'UPDATE Usuarios SET proveedor_oauth = ? WHERE correo = ?',
              [proveedor, email]
            );
            user.proveedor_oauth = proveedor;
          }
        } else {
          const [result] = await poolPromise.query(
            `INSERT INTO Usuarios (nombre, correo, telefono, contrasena, metodo_autenticacion, proveedor_oauth)
             VALUES (?, ?, NULL, 'OAUTH_NO_PASSWORD', 'OAuth', ?)`,
            [nombre, email, proveedor]
          );
          
          const [newUser] = await poolPromise.query(
            'SELECT * FROM Usuarios WHERE id_usuario = ?',
            [result.insertId]
          );
          user = newUser[0];
        }

        return done(null, user);
      } catch (err) {
        console.error("❌ Error en Facebook OAuth:", err);
        done(err, null);
      }
    }
  )
);

// Serialización / deserialización
passport.serializeUser((user, done) => done(null, user.id_usuario));

passport.deserializeUser(async (id, done) => {
  try {
    const [rows] = await poolPromise.query(
      'SELECT * FROM Usuarios WHERE id_usuario = ?',
      [id]
    );
    done(null, rows[0]);
  } catch (err) {
    done(err, null);
  }
});

export default passport;