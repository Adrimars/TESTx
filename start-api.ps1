$env:DATABASE_URL = "postgresql://postgres:orkundilay321@localhost:5432/testx?schema=public"
$env:JWT_ACCESS_SECRET = "dev-access-secret"
$env:JWT_REFRESH_SECRET = "dev-refresh-secret"
$env:API_PORT = "4000"
$env:EVALUATOR_APP_URL = "http://localhost:3000"
$env:ADMIN_APP_URL = "http://localhost:3001"
Set-Location "$PSScriptRoot\apps\api"
pnpm exec tsx watch src/index.ts
