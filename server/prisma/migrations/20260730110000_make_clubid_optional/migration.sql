-- Platform admin: tornar clubId opcional para suportar contas sem clube
-- Colunas FK nullable em MySQL são válidas — valores NULL ignoram a restrição FK
ALTER TABLE `users` MODIFY COLUMN `clubId` VARCHAR(191) NULL;
