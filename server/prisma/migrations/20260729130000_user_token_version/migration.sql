-- Migration: adicionar tokenVersion ao User para invalidação imediata de sessões
ALTER TABLE `users` ADD COLUMN `tokenVersion` INT NOT NULL DEFAULT 0;
