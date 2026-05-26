-- seed_data.sql
-- Inserta usuarios y registros de ejemplo para las tablas principales.
-- Ajusta el nombre de la base de datos si tu schema no es `tic_db`.

USE tic_db;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =============================================
-- Usuarios con contraseña 12345 (bcrypt hash)
-- =============================================
-- Contraseña plana: 12345
-- Hash bcrypt generado para 12345:
-- $2b$10$0CU5ygLEx4M9DDDgN390b.gijvkJ6Hn.GSh4AwdSqqWYWGG/eMm9S

INSERT INTO users (id, parent_id, student_code, name, email, password_hash, role, status, must_change_password, grade, section)
VALUES
  (1, NULL, NULL, 'Admin Principal', 'admin@demo.com', '$2b$10$0CU5ygLEx4M9DDDgN390b.gijvkJ6Hn.GSh4AwdSqqWYWGG/eMm9S', 'ADMIN', 'active', 0, NULL, NULL),
  (2, NULL, NULL, 'Bar User', 'bar@demo.com', '$2b$10$0CU5ygLEx4M9DDDgN390b.gijvkJ6Hn.GSh4AwdSqqWYWGG/eMm9S', 'BAR', 'active', 0, NULL, NULL),
  (3, NULL, NULL, 'Padre Demo', 'padre@demo.com', '$2b$10$0CU5ygLEx4M9DDDgN390b.gijvkJ6Hn.GSh4AwdSqqWYWGG/eMm9S', 'PADRE', 'active', 0, NULL, NULL),
  (4, 3, 'STU-000004', 'Estudiante Demo', 'estudiante@demo.com', '$2b$10$0CU5ygLEx4M9DDDgN390b.gijvkJ6Hn.GSh4AwdSqqWYWGG/eMm9S', 'ESTUDIANTE', 'active', 0, '10', 'A');

-- =============================================
-- Perfil de padre
-- =============================================
INSERT INTO parentprofiles (id, user_id, phone)
VALUES
  (1, 3, '+593999123456');

-- =============================================
-- Estudiante en la tabla schoolstudents (opcional)
-- =============================================
INSERT INTO schoolstudents (id, parent_id, name, grade, section)
VALUES
  (1, 3, 'Estudiante Demo', '10', 'A');

-- =============================================
-- Categoría de ejemplo
-- =============================================
INSERT INTO categories (id, name, description, is_active)
VALUES
  (1, 'Bebidas', 'Bebidas frías y calientes', 1);

-- =============================================
-- Plato de ejemplo
-- =============================================
INSERT INTO dishes (id, name, description, price, image_path, category_id, stock, is_active)
VALUES
  (1, 'Jugo Natural', 'Jugo de frutas natural', 2.50, NULL, 1, 50, 1);

-- =============================================
-- Menú semanal de ejemplo
-- =============================================
INSERT INTO weekly_menus (id, week_start, status, published_at, created_by, is_active, created_at, updated_at)
VALUES
  (1, '2026-05-27', 'PUBLISHED', NOW(), 2, 1, NOW(), NOW());

-- =============================================
-- Item de menú semanal de ejemplo
-- =============================================
INSERT INTO weekly_menu_items (id, weekly_menu_id, scheduled_for, dish_id, is_enabled, snapshot_name, snapshot_description, snapshot_price, snapshot_stock, snapshot_image_path, snapshot_category_id, created_at)
VALUES
  (1, 1, '2026-05-27', 1, 1, 'Jugo Natural', 'Jugo de frutas natural', 2.50, 50, NULL, 1, NOW());

-- =============================================
-- Pedido de ejemplo
-- =============================================
INSERT INTO orders (id, student_id, user_id, weekly_menu_id, total, payment_reference, receipt_image_path, payment_verified_at, status, scheduled_for, created_at)
VALUES
  (1, 4, 3, 1, 2.50, 'REF-001', NULL, NULL, 'PENDIENTE', '2026-05-27', NOW());

-- =============================================
-- Item de pedido de ejemplo
-- =============================================
INSERT INTO orderitems (id, order_id, dish_id, student_id, quantity, price)
VALUES
  (1, 1, 1, 4, 1, 2.50);

SET FOREIGN_KEY_CHECKS = 1;
