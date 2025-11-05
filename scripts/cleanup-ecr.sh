#!/bin/bash
# Remove old Docker images from ECR to save storage costs
# Usage: ./cleanup-ecr.sh [KEEP_COUNT]

REPO_NAME="hr-ai"
REGION="us-east-1"
KEEP_COUNT=${1:-10}  # Default: keep last 10 images

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "======================================"
echo "ECR Repository Cleanup"
echo "======================================"
echo "Repository: $REPO_NAME"
echo "Region: $REGION"
echo "Images to keep: $KEEP_COUNT"
echo ""

# Check if repository exists
if ! aws ecr describe-repositories --repository-names $REPO_NAME --region $REGION > /dev/null 2>&1; then
    echo -e "${RED}Error: Repository '$REPO_NAME' not found${NC}"
    exit 1
fi

# Get all images sorted by push date (oldest first)
echo "Fetching image list..."
IMAGES=$(aws ecr describe-images \
    --repository-name $REPO_NAME \
    --region $REGION \
    --query 'sort_by(imageDetails,& imagePushedAt)[*].[imageDigest,imagePushedAt,imageTags[0]]' \
    --output text)

if [ -z "$IMAGES" ]; then
    echo -e "${YELLOW}No images found in repository${NC}"
    exit 0
fi

# Count images
TOTAL_IMAGES=$(echo "$IMAGES" | wc -l)
echo "Total images in repository: $TOTAL_IMAGES"

if [ $TOTAL_IMAGES -le $KEEP_COUNT ]; then
    echo -e "${GREEN}✓ No cleanup needed${NC}"
    echo "Image count ($TOTAL_IMAGES) is within limit ($KEEP_COUNT)"
    exit 0
fi

DELETE_COUNT=$((TOTAL_IMAGES - KEEP_COUNT))
echo -e "${YELLOW}Will delete $DELETE_COUNT old images${NC}"
echo ""

# Get images to delete (oldest ones)
IMAGES_TO_DELETE=$(echo "$IMAGES" | head -n $DELETE_COUNT)

echo "Images to be deleted:"
echo "------------------------------------"
echo "$IMAGES_TO_DELETE" | while read -r digest date tag; do
    echo "  Digest: ${digest:0:20}... | Date: $date | Tag: ${tag:-<none>}"
done
echo "------------------------------------"
echo ""

# Confirmation
read -p "Proceed with deletion? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled"
    exit 0
fi

# Delete images
echo ""
echo "Deleting old images..."
DELETED=0
FAILED=0

echo "$IMAGES_TO_DELETE" | while read -r digest date tag; do
    if aws ecr batch-delete-image \
        --repository-name $REPO_NAME \
        --image-ids imageDigest=$digest \
        --region $REGION > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Deleted: ${digest:0:20}..."
        ((DELETED++))
    else
        echo -e "${RED}✗${NC} Failed: ${digest:0:20}..."
        ((FAILED++))
    fi
done

echo ""
echo "======================================"
echo "Cleanup Summary"
echo "======================================"
echo "Total images before: $TOTAL_IMAGES"
echo "Images deleted: $DELETE_COUNT"
echo "Images remaining: $KEEP_COUNT"

# Calculate storage savings (approximate)
STORAGE_SAVED=$((DELETE_COUNT * 50))  # Assume ~50MB per image
echo "Estimated storage saved: ~${STORAGE_SAVED}MB"
echo "======================================"
echo ""
echo -e "${GREEN}✓ Cleanup completed successfully${NC}"

