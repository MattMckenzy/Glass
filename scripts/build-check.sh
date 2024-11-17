#!/bin/bash
cd /home/mattmckenzy/Projects/Glass || exit 1

# Test project build
npm run package

# Clean up
npm run clean