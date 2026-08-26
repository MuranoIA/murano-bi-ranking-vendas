param(
  [string]$Source = "C:\Users\romul\Downloads\WhatsApp Video 2026-08-14 at 10.01.17.mp4",
  [string]$DestFolder = "media"
)

if (-not (Test-Path $Source)) {
  Write-Host "Arquivo de origem não encontrado: $Source" -ForegroundColor Yellow
  Write-Host "Passe o caminho como parâmetro ou mova o arquivo manualmente." -ForegroundColor Yellow
  exit 1
}

if (-not (Test-Path $DestFolder)) { New-Item -ItemType Directory -Path $DestFolder | Out-Null }

$dest = Join-Path -Path $DestFolder -ChildPath (Split-Path $Source -Leaf)
Write-Host "Copiando:`n  $Source`n→ $dest"
Copy-Item -Path $Source -Destination $dest -Force
if (Test-Path $dest) { Write-Host "Pronto: arquivo copiado para $dest" -ForegroundColor Green } else { Write-Host "Falha ao copiar o arquivo" -ForegroundColor Red; exit 2 }
