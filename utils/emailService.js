import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { userEmailResponse } from './userEmailResponse.js';
import { barEmailResponse } from './barEmailResponse.js';

dotenv.config();

  export const sendVerificationEmail = async (email, token,FOR) => {
    const {mod,data = {}} = FOR;
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });

      const verificationUrl = `${process.env.APP_URL}/api/verify/${token}`;

      const emailResponse = mod === "user" ? userEmailResponse(verificationUrl) : mod === "bar" ? barEmailResponse(verificationUrl,data.email,data.password) : "";

      if(!emailResponse) {
        console.log("No se genero ningún template");
        return;
      }

      const mailOptions = {
        from: `"Bar Escolar" <${process.env.EMAIL_FROM}>`,
        to: email,
        subject: 'Verifica tu cuenta - Bar Escolar',
        html: emailResponse
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Email de verificación enviado:', info.messageId);
      
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error al enviar email de verificación:', error);
      throw new Error(`Error al enviar el correo de verificación: ${error.message}`);
    }
  }