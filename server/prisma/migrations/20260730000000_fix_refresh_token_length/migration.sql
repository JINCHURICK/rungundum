-- Fix: aumentar coluna token de VARCHAR(191) para VARCHAR(512)
-- O JWT de refresh token tem ~285 chars; VARCHAR(191) truncava silenciosamente,
-- fazendo com que findUnique nunca encontrasse o token completo enviado pelo cliente.
ALTER TABLE `refresh_tokens`
  DROP INDEX `refresh_tokens_token_key`,
  MODIFY COLUMN `token` VARCHAR(512) NOT NULL,
  ADD UNIQUE INDEX `refresh_tokens_token_key` (`token`);
