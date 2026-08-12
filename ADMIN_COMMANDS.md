# Rungundum — Comandos de Administração

> Referência de comandos SQL e PowerShell para gestão da plataforma.
> Todos os comandos SQL são para colar directamente no cliente PostgreSQL.

---

## Super Admin

### Criar super admin (sem clube)
Primeiro gera o hash da password no VPS:
```powershell
cd C:\apps\rungundum\server
node -e "require('bcryptjs').hash('A_TUA_PASSWORD', 10).then(h => console.log(h))"
```

Depois cola no PostgreSQL (substitui `HASH_AQUI` pelo hash gerado):
```sql
INSERT INTO users (id, "clubId", email, "passwordHash", role, "emailVerified", "platformAdmin", "tokenVersion", "createdAt", "updatedAt")
VALUES (
  concat('adm', to_hex(floor(random() * 1000000000)::int)),
  NULL,
  'danielmotaviegas@gmail.com',
  'HASH_AQUI',
  'APP_ADMIN',
  true,
  true,
  0,
  NOW(),
  NOW()
);
```

### Activar platformAdmin num utilizador existente
```sql
UPDATE users SET "platformAdmin" = true WHERE email = 'email@exemplo.com';
```

### Revogar acesso de platform admin
```sql
UPDATE users SET "platformAdmin" = false, role = 'MEMBER' WHERE email = 'email@exemplo.com';
```

---

## Clubes

### Apagar um clube (e todos os dados associados)
```sql
-- Ver o clube antes de apagar
SELECT id, name, acronym, "planStatus", "createdAt" FROM clubs WHERE name ILIKE '%nome%';

-- Apagar membros do clube
DELETE FROM members WHERE "clubId" = 'ID_DO_CLUBE';

-- Apagar utilizadores do clube
DELETE FROM users WHERE "clubId" = 'ID_DO_CLUBE';

-- Apagar o clube (cascade trata do resto)
DELETE FROM clubs WHERE id = 'ID_DO_CLUBE';
```

### Listar todos os clubes
```sql
SELECT id, name, acronym, location, "planStatus", "trialEndsAt", "createdAt"
FROM clubs
ORDER BY "createdAt" DESC;
```

### Clubes em trial a expirar nos próximos 7 dias
```sql
SELECT name, acronym, "trialEndsAt",
  EXTRACT(DAY FROM "trialEndsAt" - NOW()) AS dias_restantes
FROM clubs
WHERE "planStatus" = 'TRIAL'
  AND "trialEndsAt" BETWEEN NOW() AND NOW() + INTERVAL '7 days'
ORDER BY "trialEndsAt";
```

### Clubes com subscrição expirada
```sql
SELECT name, acronym, "planStatus", "planExpiresAt"
FROM clubs
WHERE "planStatus" IN ('EXPIRED', 'CANCELLED')
ORDER BY "planExpiresAt" DESC;
```

---

## Subscrições e Planos

### Forçar plano activo num clube
```sql
UPDATE clubs
SET "planStatus" = 'ACTIVE',
    "planExpiresAt" = NOW() + INTERVAL '1 year'
WHERE id = 'ID_DO_CLUBE';
```

### Estender trial de um clube
```sql
UPDATE clubs
SET "trialEndsAt" = NOW() + INTERVAL '14 days'
WHERE id = 'ID_DO_CLUBE';
```

### Cancelar subscrição de um clube
```sql
UPDATE clubs
SET "planStatus" = 'CANCELLED'
WHERE id = 'ID_DO_CLUBE';
```

---

## Utilizadores

### Listar utilizadores de um clube
```sql
SELECT u.email, u.role, u."platformAdmin", u."emailVerified", u."createdAt",
       m."fullName", m.nickname
FROM users u
LEFT JOIN members m ON m."userId" = u.id
WHERE u."clubId" = 'ID_DO_CLUBE';
```

### Resetar password de um utilizador
Gera hash no VPS:
```powershell
node -e "require('bcryptjs').hash('NOVA_PASSWORD', 10).then(h => console.log(h))"
```
```sql
UPDATE users
SET "passwordHash" = 'HASH_AQUI', "tokenVersion" = "tokenVersion" + 1
WHERE email = 'email@exemplo.com';
```

### Forçar logout de um utilizador (invalida todos os tokens)
```sql
UPDATE users SET "tokenVersion" = "tokenVersion" + 1 WHERE email = 'email@exemplo.com';
DELETE FROM refresh_tokens WHERE "userId" = (SELECT id FROM users WHERE email = 'email@exemplo.com');
```

### Verificar email manualmente
```sql
UPDATE users SET "emailVerified" = true WHERE email = 'email@exemplo.com';
```

### Mudar email de um utilizador (incluindo super admin)
```sql
UPDATE users
SET email = 'novo@email.com',
    "emailVerified" = true,
    "tokenVersion" = "tokenVersion" + 1
WHERE email = 'email_antigo@exemplo.com';
```

---

## Planos da Plataforma

### Apagar cache de planos (forçar releitura da BD)
```powershell
Remove-Item "C:\apps\rungundum\server\data\plan-configs.json" -ErrorAction SilentlyContinue
```

### Ver planos guardados na BD
```sql
SELECT "planConfigs" FROM platform_settings WHERE id = 'singleton';
```

### Apagar planos configurados (volta a mostrar lista vazia)
```sql
UPDATE platform_settings SET "planConfigs" = '[]' WHERE id = 'singleton';
```

---

## Servidor (PowerShell VPS)

### Monitorização

```powershell
# Estado de todos os processos
pm2 list

# Logs do servidor em tempo real
pm2 logs rungundum --lines 50

# Logs do Caddy (proxy)
pm2 logs caddy --lines 20

# Portas em escuta (80, 443, 3001)
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in @(80, 443, 3001) } | ForEach-Object { $p = Get-Process -Id $_.OwningProcess; "$($_.LocalPort) → $($p.Name) (PID $($p.Id))" }
```

---

### Deploy completo (passo a passo)

```powershell
# 1. Parar o servidor
pm2 stop rungundum

# 2. Buscar código novo
cd C:\apps\rungundum
git pull

# 3. Instalar/actualizar dependências (obrigatório se package.json mudou)
cd server
npm install --production=false

# 4. Compilar TypeScript
npm run build

# 5. Arrancar e guardar estado
pm2 start rungundum
pm2 save
```

> **Nota:** O `npm run build` não instala pacotes — sempre correr `npm install` antes se houve alterações ao `package.json`.

---

### Reiniciar só o servidor (sem deploy)

```powershell
pm2 restart rungundum
```

### Reiniciar o Caddy (proxy reverso)

```powershell
pm2 restart caddy
pm2 logs caddy --lines 20 --nostream
```

---

### Diagnóstico de uploads (Request aborted)

Se os uploads de imagens falharem com erro `Request aborted`:

**1. Verificar ambiente**
```powershell
node -v
node -e "console.log(require('C:/apps/rungundum/server/node_modules/multer/package.json').version)"
```

**2. Testar upload directo ao Express (bypassar Caddy e Bitdefender)**
```powershell
# Substituir a password
$token = (Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"email":"danielmotaviegas@gmail.com","password":"TUA_PASSWORD"}').accessToken

$bytes = [System.IO.File]::ReadAllBytes("C:\Windows\Web\Wallpaper\Windows\img0.jpg")
$content = [System.Net.Http.MultipartFormDataContent]::new()
$imgContent = [System.Net.Http.ByteArrayContent]::new($bytes)
$imgContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new("image/jpeg")
$content.Add($imgContent, "logo", "test.jpg")
$client = [System.Net.Http.HttpClient]::new()
$client.DefaultRequestHeaders.Add("Authorization", "Bearer $token")
($client.PostAsync("http://localhost:3001/api/clubs/me/logo", $content).Result).StatusCode
```

- **200 →** Express funciona. Problema é Caddy ou Bitdefender no porto 443.
- **Erro →** Problema no servidor Express/multer.

**3. Se o problema for Bitdefender**

Bitdefender → Protection → Online Threat Prevention → Exclusões → adicionar `C:\apps\rungundum\` ou o processo `node.exe`.
