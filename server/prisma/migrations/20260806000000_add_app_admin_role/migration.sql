-- Adicionar novo papel APP_ADMIN ao enum UserRole
-- MySQL requer ALTER TABLE para modificar enums existentes
ALTER TABLE `users` MODIFY COLUMN `role` ENUM(
  'ADMIN',
  'APP_ADMIN',
  'VICE_PRESIDENT',
  'TREASURER',
  'SECRETARY',
  'PR',
  'DISCIPLINA',
  'CAPTAIN',
  'MEMBER',
  'GUEST'
) NOT NULL DEFAULT 'MEMBER';
