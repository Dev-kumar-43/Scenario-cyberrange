#!/bin/bash
set -e

cd /mnt/c/Users/DevKumar/Desktop/Scenario-cyberrange

echo "======================================================="
echo "Building Cyber-Range AttackBox Docker Image"
echo "======================================================="

docker build -t cyber-range-gui:latest -t cyber-range-gui:attackbox -f docker/kali-gui/Dockerfile docker/kali-gui/

echo "Build successful! Docker images:"
docker images | grep cyber-range-gui
