# Serves the built studio (the out folder) at http://127.0.0.1:5181/
Write-Host "Film Studio Companion: http://127.0.0.1:5181/"
python -m http.server 5181 --bind 127.0.0.1 --directory "$PSScriptRoot\out"
