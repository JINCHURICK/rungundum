CREATE TABLE `hand_signals` (
  `id`          VARCHAR(191) NOT NULL,
  `clubId`      VARCHAR(191) NOT NULL,
  `name`        VARCHAR(191) NOT NULL,
  `description` LONGTEXT     NULL,
  `imageUrl`    VARCHAR(191) NULL,
  `order`       INT          NOT NULL DEFAULT 0,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `hand_signals_clubId_idx` (`clubId`),
  CONSTRAINT `hand_signals_clubId_fkey`
    FOREIGN KEY (`clubId`) REFERENCES `clubs` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
