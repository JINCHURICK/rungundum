-- Índice composto em members(clubId, status)
-- Acelera todas as queries de membros filtradas por clube + estado (activo/suspenso/etc.)
CREATE INDEX `members_clubId_status_idx` ON `members`(`clubId`, `status`);

-- Índice em participants(raidId)
-- Acelera os JOINs entre raids e participantes (carregado em cada detalhe de raid)
CREATE INDEX `participants_raidId_idx` ON `participants`(`raidId`);

-- Índice em refresh_tokens(userId)
-- Acelera o deleteMany ao fazer logout (elimina todos os tokens do utilizador)
CREATE INDEX `refresh_tokens_userId_idx` ON `refresh_tokens`(`userId`);
