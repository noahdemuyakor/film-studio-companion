# Starts the local bridge so the studio's Claude Power Engine runs on your Claude Code sign-in.
# Uses the lasting token saved in your user environment (FSC_BRIDGE_TOKEN), so you paste it into Settings once.
$env:Path += ";$env:USERPROFILE\.local\bin"
$env:FSC_BRIDGE_TOKEN = [Environment]::GetEnvironmentVariable('FSC_BRIDGE_TOKEN', 'User')
$env:PORT = '4317'
node "$PSScriptRoot\bridge\fsc-bridge.mjs"
