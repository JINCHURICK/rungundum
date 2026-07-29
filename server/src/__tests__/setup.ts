// Definir variáveis de ambiente ANTES de qualquer import de módulo
// (jwt.ts captura JWT_SECRET com const no topo do ficheiro)
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-min-32-chars'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-testing-min-32-chars'
process.env.NODE_ENV = 'test'
process.env.CLIENT_URL = 'http://localhost:5173'
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test'
