$ErrorActionPreference = "Stop"

if (-not (Test-Path -Path "dist" -PathType Container)) {
    Write-Error "No production build was found. Run 'npm run build' before starting the preview server."
    exit 1
}

& npm.cmd run preview
exit $LASTEXITCODE
