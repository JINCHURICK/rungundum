-- Rastreio de dispositivo e actividade por sessão
ALTER TABLE `refresh_tokens`
  ADD COLUMN `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `ipAddress`  VARCHAR(45) NULL,
  ADD COLUMN `userAgent`  TEXT        NULL;
