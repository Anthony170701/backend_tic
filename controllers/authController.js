// controllers/auth.controller.js
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { sequelize } from "../db/conexion.js";
import { User } from "../models/UserModel.js";
import { ParentProfile } from "../models/ParentProfileModel.js";

const JWT_SECRET = process.env.JWT_SECRET || "clave_secreta";

/**
 * ============================
 * Helper: enviar credenciales por correo
 * ============================
 */
const sendCredentialsEmail = async ({ to, name, tempPassword, role }) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP no configurado (faltan SMTP_HOST/SMTP_USER/SMTP_PASS en .env)");
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const subject = "Credenciales de acceso - Aristos-Calceta";

  const text = `
Hola ${name},

Se ha creado tu cuenta en Aristos-Calceta.

Usuario (email): ${to}
Rol: ${role}
Contraseña temporal: ${tempPassword}

Por seguridad, inicia sesión y cambia tu contraseña en la opción "Cambiar contraseña".

Saludos.
`.trim();

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });
};

/**
 * ============================
 * Registrar usuario (SOLO ADMIN)
 *
 * Soporta:
 * - Crear ESTUDIANTE con parent_id opcional (valida que parent_id sea PADRE)
 * - Crear PADRE con student_ids opcional (asigna hijos en masa)
 * - Crear BAR / ADMIN normal
 * ============================
 */
export const register = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { name, email, role, phone, parent_id, student_ids, grade, section } = req.body;

    if (!name || !email) {
      await transaction.rollback();
      return res.status(400).json({ message: "Faltan campos obligatorios: name, email" });
    }

    const allowedRoles = ["ADMIN", "BAR", "PADRE", "ESTUDIANTE"];
    const finalRole = (role || "PADRE").toUpperCase();

    if (!allowedRoles.includes(finalRole)) {
      await transaction.rollback();
      return res.status(400).json({ message: "Rol inválido" });
    }

    // ✅ Email único (dentro de transacción)
    const existingUser = await User.findOne({ where: { email }, transaction });
    if (existingUser) {
      await transaction.rollback();
      return res.status(400).json({ message: "El correo ya está registrado" });
    }

    // ✅ Si crean ESTUDIANTE y mandan parent_id: validar que exista y sea PADRE
    let finalParentId = null;
    if (finalRole === "ESTUDIANTE" && parent_id != null) {
      const parent = await User.findByPk(parent_id, { transaction });
      if (!parent) {
        await transaction.rollback();
        return res.status(400).json({ message: "parent_id no existe" });
      }
      if (parent.role !== "PADRE") {
        await transaction.rollback();
        return res.status(400).json({ message: "El parent_id debe ser un usuario con rol PADRE" });
      }
      finalParentId = parent.id;
    }

    // Generar contraseña temporal
    const tempPassword = crypto.randomBytes(7).toString("base64url");
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Crear usuario
    const user = await User.create(
      {
        name,
        email,
        password_hash: hashedPassword,
        role: finalRole,
        status: "active",
        must_change_password: true,
        parent_id: finalParentId, // ✅ solo aplica si es ESTUDIANTE y se asignó padre
        grade: finalRole === "ESTUDIANTE" ? (grade ?? null) : null,
        section: finalRole === "ESTUDIANTE" ? (section ?? null) : null,
      },
      { transaction }
    );

    // ✅ Si es ESTUDIANTE: generar student_code fijo por id
    if (finalRole === "ESTUDIANTE") {
      const code = `STU-${String(user.id).padStart(6, "0")}`;
      await user.update({ student_code: code }, { transaction });
    }

    // ✅ Si es PADRE → crear ParentProfile (con phone opcional)
    if (finalRole === "PADRE") {
      await ParentProfile.findOrCreate({
        where: { user_id: user.id },
        defaults: {
          user_id: user.id,
          phone: phone ?? null,
        },
        transaction,
      });

      // ✅ Si al crear PADRE vienen student_ids: asignarlos (1 padre por estudiante)
      if (Array.isArray(student_ids) && student_ids.length > 0) {
        const students = await User.findAll({
          where: { id: student_ids },
          transaction,
        });

        // Validar todos existan y sean estudiantes
        if (students.length !== student_ids.length) {
          await transaction.rollback();
          return res.status(400).json({ message: "Uno o más student_ids no existen" });
        }

        for (const st of students) {
          if (st.role !== "ESTUDIANTE") {
            await transaction.rollback();
            return res.status(400).json({ message: `El usuario ${st.id} no es ESTUDIANTE` });
          }
        }

        // ⚙️ Si quieres evitar "robar" estudiantes con padre, usa parent_id: null en el WHERE
        await User.update(
          { parent_id: user.id },
          {
            where: { id: student_ids, role: "ESTUDIANTE" },
            transaction,
          }
        );
      }
    }

    await transaction.commit();

    // Enviar correo (fuera de transacción ya comprometida)
    try {
      await sendCredentialsEmail({
        to: email,
        name,
        tempPassword,
        role: user.role,
      });

      return res.status(201).json({
        message: "Usuario creado y credenciales enviadas al correo.",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          parent_id: user.parent_id ?? null,
          student_code: user.student_code ?? null,
          grade: user.grade ?? null,
          section: user.section ?? null,
        },
      });
    } catch (mailErr) {
      console.error("⚠️ No se pudo enviar correo:", mailErr?.message || mailErr);

      return res.status(201).json({
        message: "Usuario creado, pero no se pudo enviar el correo.",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          parent_id: user.parent_id ?? null,
          student_code: user.student_code ?? null,
          grade: user.grade ?? null,
          section: user.section ?? null,
        },
      });
    }
  } catch (error) {
    await transaction.rollback();
    console.error("Error en registro:", error);
    return res.status(500).json({
      message: "Error al registrar usuario",
      error: error.message,
    });
  }
};

/**
 * ============================
 * Login
 * ============================
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ message: "Contraseña incorrecta" });

    if (user.status === "inactive") {
      return res.status(401).json({ message: "Usuario inactivo" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        parent_id: user.parent_id ?? null,
        student_code: user.student_code ?? null,
        must_change_password: !!user.must_change_password,
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      message: "Inicio de sesión exitoso",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        parent_id: user.parent_id ?? null,
        student_code: user.student_code ?? null,
        grade: user.grade ?? null,
        section: user.section ?? null,
        must_change_password: !!user.must_change_password,
      },
      mustChangePassword: !!user.must_change_password,
    });
  } catch (error) {
    console.error("Error en login:", error);
    return res.status(500).json({
      message: "Error al iniciar sesión",
      error: error.message,
    });
  }
};

/**
 * ============================
 * Cambiar contraseña
 * ============================
 */
export const changePassword = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Debe proporcionar ambas contraseñas" });
    }

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Contraseña actual incorrecta" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await user.update({
      password_hash: hashed,
      must_change_password: false,
    });

    return res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("Error en changePassword:", error);
    return res.status(500).json({
      message: "Error al cambiar contraseña",
      error: error.message,
    });
  }
};