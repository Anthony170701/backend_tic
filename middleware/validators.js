
import { body, validationResult } from 'express-validator';

const validators = {
  validateRegister: [
    // Validación del nombre
    body('firstName')
      .trim()
      .notEmpty().withMessage('El nombre es requerido')
      .isLength({ min: 2, max: 50 }).withMessage('El nombre debe tener entre 2 y 50 caracteres')
      .matches(/^[A-Za-zÁáÉéÍíÓóÚúÑñ\s]+$/).withMessage('El nombre solo puede contener letras'),

    // Validación del apellido
    body('lastName')
      .trim()
      .notEmpty().withMessage('El apellido es requerido')
      .isLength({ min: 2, max: 50 }).withMessage('El apellido debe tener entre 2 y 50 caracteres')
      .matches(/^[A-Za-zÁáÉéÍíÓóÚúÑñ\s]+$/).withMessage('El apellido solo puede contener letras'),

    // Validación del email
    body('email')
      .trim()
      .notEmpty().withMessage('El email es requerido')
      .isEmail().withMessage('Debe ser un email válido')
      .normalizeEmail(),

    // Validación de la contraseña
    body('password')
      .trim()
      .notEmpty().withMessage('La contraseña es requerida')
      .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
      .matches(/\d/).withMessage('La contraseña debe contener al menos un número')
      .matches(/[A-Z]/).withMessage('La contraseña debe contener al menos una mayúscula')
      .matches(/[a-z]/).withMessage('La contraseña debe contener al menos una minúscula')
      .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('La contraseña debe contener al menos un carácter especial'),

    // Validación de confirmación de contraseña
    body('confirmPassword')
      .trim()
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Las contraseñas no coinciden');
        }
        return true;
      }),

    // Validación del rol
    body('role')
      .trim()
      .notEmpty().withMessage('El rol es requerido')
      .isIn(['student', 'parent', 'staff', 'admin', 'bar_manager'])
      .withMessage('Rol no válido'),

    // Validación del teléfono
    body('phone')
      .optional()
      .trim()
      .matches(/^\+?[\d\s-]+$/).withMessage('Número de teléfono no válido'),

    // Validaciones específicas para estudiantes
    body('grade')
      .if(body('role').equals('student'))
      .notEmpty().withMessage('El grado es requerido para estudiantes'),

    body('section')
      .if(body('role').equals('student'))
      .notEmpty().withMessage('La sección es requerida para estudiantes'),

    body('studentId')
      .if(body('role').equals('student'))
      .notEmpty().withMessage('El ID de estudiante es requerido'),

    // Validaciones específicas para padres
    body('identification')
      .if(body('role').equals('parent'))
      .notEmpty().withMessage('La identificación es requerida para padres'),

    body('relationship')
      .if(body('role').equals('parent'))
      .notEmpty().withMessage('El parentesco es requerido')
      .isIn(['father', 'mother', 'guardian']).withMessage('Parentesco no válido'),
  ],

  validateLogin: [
    // Validación del email
    body('email')
      .trim()
      .notEmpty().withMessage('El email es requerido')
      .isEmail().withMessage('Debe ser un email válido')
      .normalizeEmail(),

    // Validación de la contraseña
    body('password')
      .trim()
      .notEmpty().withMessage('La contraseña es requerida'),
  ],

  // Middleware para manejar los resultados de la validación
  validate: (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array().map(error => ({
          field: error.param,
          message: error.msg
        }))
      });
    }
    next();
  }
};

// Exportar los middlewares de validación combinados con el manejador de errores
module.exports = {
  validateRegister: [...validators.validateRegister, validators.validate],
  validateLogin: [...validators.validateLogin, validators.validate]
};