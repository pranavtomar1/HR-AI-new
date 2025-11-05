#!/bin/bash
# Clean up Docker system on Jenkins server
# Run this script to free up disk space

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "======================================"
echo "Docker System Cleanup"
echo "======================================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Show disk usage before cleanup
echo "Disk usage BEFORE cleanup:"
echo "------------------------------------"
docker system df
echo ""

# Calculate space to be freed
RECLAIMABLE=$(docker system df -v | grep "Reclaimable" | awk '{sum+=$4} END {print sum}')
echo -e "${YELLOW}Reclaimable space: ~$RECLAIMABLE${NC}"
echo ""

# Confirmation
read -p "Proceed with cleanup? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled"
    exit 0
fi

echo ""
echo "Cleaning up Docker resources..."
echo ""

# Remove stopped containers
echo "1. Removing stopped containers..."
CONTAINERS=$(docker container prune -f 2>&1 | grep "deleted" | wc -l)
echo -e "${GREEN}✓${NC} Removed $CONTAINERS stopped containers"

# Remove unused images
echo "2. Removing unused images..."
IMAGES_BEFORE=$(docker images -q | wc -l)
docker image prune -a -f > /dev/null 2>&1
IMAGES_AFTER=$(docker images -q | wc -l)
IMAGES_REMOVED=$((IMAGES_BEFORE - IMAGES_AFTER))
echo -e "${GREEN}✓${NC} Removed $IMAGES_REMOVED unused images"

# Remove unused volumes
echo "3. Removing unused volumes..."
VOLUMES=$(docker volume prune -f 2>&1 | grep "deleted" | wc -l)
echo -e "${GREEN}✓${NC} Removed $VOLUMES unused volumes"

# Remove build cache
echo "4. Removing build cache..."
docker builder prune -f > /dev/null 2>&1
echo -e "${GREEN}✓${NC} Build cache cleared"

# Remove unused networks
echo "5. Cleaning up networks..."
docker network prune -f > /dev/null 2>&1
echo -e "${GREEN}✓${NC} Unused networks removed"

echo ""
echo "======================================"
echo "Cleanup Summary"
echo "======================================"

# Show disk usage after cleanup
echo "Disk usage AFTER cleanup:"
echo "------------------------------------"
docker system df
echo ""

echo -e "${GREEN}✓ Docker cleanup completed successfully${NC}"
echo ""
echo "Recommendations:"
echo "  - Run this script weekly to maintain disk space"
echo "  - Add to crontab: 0 2 * * 0 /path/to/cleanup-docker.sh"
echo "  - Monitor disk usage: df -h"

