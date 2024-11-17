#!/bin/bash
rm -rf out
npm i
npm run package
(
    cd out/glass-linux-x64 || exit
    sudo find . -type f -exec install -Dm 755 "{}" "/opt/glass/{}" \;
)
sudo install -m 644 src/resources/.desktop /usr/share/applications/glass.desktop
sudo install -m 644 src/resources/logo.png /usr/share/pixmaps/glass.png
sudo ln -sf /opt/glass/glass /usr/bin/glass
 