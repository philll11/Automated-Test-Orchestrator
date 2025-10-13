# build.ps1
# This script automates the cross-compilation of the ato CLI for all target platforms.

# Stop the script if any command fails
$ErrorActionPreference = "Stop"

Write-Host "Starting build process..."

# Define the output directory
$OutputDir = "dist"

# Ensure the output directory is clean and exists
if (Test-Path $OutputDir) {
    Write-Host "Cleaning old build artifacts from '$OutputDir'..."
    Remove-Item -Recurse -Force $OutputDir
}
New-Item -ItemType Directory -Path $OutputDir | Out-Null

Write-Host "Compiling for Windows (amd64)..."
$env:GOOS="windows"; $env:GOARCH="amd64"; go build -o "$OutputDir/ato.exe" .

Write-Host "Compiling for macOS (amd64)..."
$env:GOOS="darwin"; $env:GOARCH="amd64"; go build -o "$OutputDir/ato-macos-amd64" .

Write-Host "Compiling for macOS (arm64)..."
$env:GOOS="darwin"; $env:GOARCH="arm64"; go build -o "$OutputDir/ato-macos-arm64" .

Write-Host "Compiling for Linux (amd64)..."
$env:GOOS="linux"; $env:GOARCH="amd64"; go build -o "$OutputDir/ato-linux-amd64" .

Write-Host ""
Write-Host -ForegroundColor Green "Build complete! All binaries are in the '$OutputDir' directory."