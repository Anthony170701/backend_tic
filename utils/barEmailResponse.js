export const barEmailResponse = (verificationUrl, email, password) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333; text-align: center;">¡Bienvenido a Bar Escolar!</h1>
      
      <div style="background-color: #eef5ff; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h2 style="color: #333;">Tus credenciales de acceso</h2>
        <p style="color: #666; font-size: 14px;">
          <strong>Email:</strong> ${email}<br>
          <strong>Contraseña:</strong> ${password}
        </p>
        <p style="color: #999; font-size: 12px;">
          Te recomendamos cambiar tu contraseña luego de iniciar sesión.
        </p>
      </div>

      <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p style="color: #666;">
          Gracias por unirte a nuestra plataforma. Para comenzar, primero necesitas verificar tu cuenta:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}"
             style="
               background-color: #4CAF50;
               color: white;
               padding: 12px 25px;
               text-decoration: none;
               border-radius: 5px;
               display: inline-block;
               font-weight: bold;
             ">
            Verificar mi cuenta
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:
          <br>
          <a href="${verificationUrl}" style="color: #4CAF50; word-break: break-all;">
            ${verificationUrl}
          </a>
        </p>
      </div>
      
      <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
        Si no solicitaste esta cuenta, puedes ignorar este correo.
      </p>
    </div>
  `;
};