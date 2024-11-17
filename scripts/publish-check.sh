#!/bin/bash
cd /home/mattmckenzy/Projects/Glass/glass-git || exit 1

# Test package build
makepkg
makepkg --printsrcinfo > .SRCINFO
namcap PKGBUILD
namcap ./*.pkg.tar.zst

# Cleanup
echo "Cleaning up..."
find . -mindepth 1 -maxdepth 1 -not \
    \( -name 'PKGBUILD' -or -name '.SRCINFO' -or -name '.gitignore' -or -name '.git' -or -name 'build-check.sh' \) \
    -exec sudo rm -rf {} \;