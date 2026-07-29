-- Push subscriptions para Web Push API (PWA notifications)
CREATE TABLE `push_subscriptions` (
  `id`        VARCHAR(191)  NOT NULL,
  `userId`    VARCHAR(191)  NOT NULL,
  `endpoint`  TEXT          NOT NULL,
  `p256dh`    TEXT          NOT NULL,
  `auth`      VARCHAR(255)  NOT NULL,
  `createdAt` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `push_subscriptions_userId_idx` (`userId`),
  CONSTRAINT `push_subscriptions_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
