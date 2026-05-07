$portToFree = if ($env:PORT) { [int]$env:PORT } else { 5000 }

$connections = Get-NetTCPConnection -LocalPort $portToFree -State Listen -ErrorAction SilentlyContinue
$processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $processIds) {
  if ($processId -and $processId -ne $PID) {
    Write-Host "Stopping process $processId on port $portToFree"
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

