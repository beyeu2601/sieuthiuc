# Day migration moi len database prod. Chay: powershell -ExecutionPolicy Bypass -File scripts\db-push.ps1
$line = Get-Content "$PSScriptRoot\..\.env.local" | Where-Object { $_ -like 'SUPABASE_DB_URL=*' } | Select-Object -First 1
if (-not $line) { Write-Host "Khong thay SUPABASE_DB_URL trong .env.local"; exit 1 }
$url = ($line -replace '^SUPABASE_DB_URL=', '').Trim().Trim('"')
if (-not $url) { Write-Host "SUPABASE_DB_URL dang rong"; exit 1 }
supabase db push --db-url $url
supabase migration list --db-url $url
