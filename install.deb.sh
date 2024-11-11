#!/bin/bash
rm -rf out
npm run make
sudo apt-get install ./out/make/deb/x64/glass_*_amd64.deb