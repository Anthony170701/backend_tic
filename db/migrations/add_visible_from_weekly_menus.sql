-- Add visible_from column to weekly_menus
ALTER TABLE `weekly_menus`
  ADD COLUMN `visible_from` DATE NULL;
