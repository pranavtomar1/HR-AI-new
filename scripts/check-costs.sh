#!/bin/bash
# Check current AWS resource usage and costs
# Usage: ./check-costs.sh

REGION="us-east-1"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "======================================"
echo "AWS Cost & Resource Report"
echo "======================================"
echo "Date: $(date)"
echo "Region: $REGION"
echo ""

# Running EC2 Instances
echo -e "${BLUE}Running EC2 Instances:${NC}"
echo "------------------------------------"
RUNNING_INSTANCES=$(aws ec2 describe-instances \
    --filters "Name=instance-state-name,Values=running" \
    --query 'Reservations[*].Instances[*].[Tags[?Key==`Name`].Value|[0],InstanceId,InstanceType,LaunchTime,PublicIpAddress]' \
    --output text \
    --region $REGION)

if [ -z "$RUNNING_INSTANCES" ]; then
    echo -e "${GREEN}No running instances${NC}"
else
    echo "$RUNNING_INSTANCES" | while read -r name id type launch ip; do
        echo "  ✓ $name"
        echo "    ID: $id | Type: $type"
        echo "    IP: ${ip:-N/A} | Started: $launch"
        echo ""
    done
fi

RUNNING_COUNT=$(echo "$RUNNING_INSTANCES" | grep -v "^$" | wc -l)
echo "Total running: $RUNNING_COUNT instances"
echo ""

# Stopped EC2 Instances
echo -e "${BLUE}Stopped EC2 Instances:${NC}"
echo "------------------------------------"
STOPPED_INSTANCES=$(aws ec2 describe-instances \
    --filters "Name=instance-state-name,Values=stopped" \
    --query 'Reservations[*].Instances[*].[Tags[?Key==`Name`].Value|[0],InstanceId,InstanceType]' \
    --output text \
    --region $REGION)

if [ -z "$STOPPED_INSTANCES" ]; then
    echo "No stopped instances"
else
    echo "$STOPPED_INSTANCES" | while read -r name id type; do
        echo "  ○ $name ($id) - $type"
    done
fi
echo ""

# EBS Volumes
echo -e "${BLUE}EBS Volumes:${NC}"
echo "------------------------------------"
VOLUMES=$(aws ec2 describe-volumes \
    --query 'Volumes[*].[VolumeId,Size,State,VolumeType,Attachments[0].InstanceId]' \
    --output text \
    --region $REGION)

TOTAL_EBS_SIZE=0
echo "$VOLUMES" | while read -r vol_id size state type instance; do
    echo "  Volume: $vol_id"
    echo "    Size: ${size}GB | Type: $type | State: $state"
    echo "    Attached to: ${instance:-None}"
    echo ""
    TOTAL_EBS_SIZE=$((TOTAL_EBS_SIZE + size))
done

TOTAL_EBS=$(echo "$VOLUMES" | grep -v "^$" | awk '{sum+=$2} END {print sum}')
echo "Total EBS storage: ${TOTAL_EBS}GB"
echo ""

# ECR Repositories
echo -e "${BLUE}ECR Repositories:${NC}"
echo "------------------------------------"
ECR_REPOS=$(aws ecr describe-repositories \
    --query 'repositories[*].[repositoryName,repositoryUri]' \
    --output text \
    --region $REGION 2>/dev/null)

if [ -z "$ECR_REPOS" ]; then
    echo "No ECR repositories"
else
    echo "$ECR_REPOS" | while read -r name uri; do
        echo "  Repository: $name"
        echo "    URI: $uri"
        
        # Get image count and size
        IMAGE_COUNT=$(aws ecr describe-images \
            --repository-name $name \
            --region $REGION \
            --query 'length(imageDetails)' \
            --output text 2>/dev/null)
        
        REPO_SIZE=$(aws ecr describe-images \
            --repository-name $name \
            --region $REGION \
            --query 'imageDetails[*].imageSizeInBytes' \
            --output text 2>/dev/null | awk '{sum+=$1} END {print sum/1024/1024}')
        
        echo "    Images: ${IMAGE_COUNT:-0}"
        echo "    Size: ${REPO_SIZE:-0} MB"
        echo ""
    done
fi

# Billing Alarms
echo -e "${BLUE}Billing Alarms:${NC}"
echo "------------------------------------"
ALARMS=$(aws cloudwatch describe-alarms \
    --alarm-name-prefix "hr-ai-billing" \
    --query 'MetricAlarms[*].[AlarmName,StateValue,Threshold]' \
    --output text \
    --region us-east-1 2>/dev/null)

if [ -z "$ALARMS" ]; then
    echo -e "${YELLOW}⚠ No billing alarms configured${NC}"
    echo "  Recommendation: Set up billing alerts"
else
    echo "$ALARMS" | while read -r name state threshold; do
        if [ "$state" == "ALARM" ]; then
            echo -e "  ${RED}✗ $name: $state (threshold: \$$threshold)${NC}"
        else
            echo -e "  ${GREEN}✓ $name: $state (threshold: \$$threshold)${NC}"
        fi
    done
fi
echo ""

# Cost Estimates
echo "======================================"
echo -e "${BLUE}Cost Estimates (per month):${NC}"
echo "======================================"

# EC2 cost (approximate)
if [ "$RUNNING_COUNT" -gt 0 ]; then
    # t2.micro is free for 750 hours/month in free tier
    EXCESS_HOURS=$(( (RUNNING_COUNT * 730) - 750 ))
    if [ $EXCESS_HOURS -gt 0 ]; then
        EC2_COST=$(echo "scale=2; $EXCESS_HOURS * 0.0116" | bc)
        echo "  EC2 (t2.micro): ~\$${EC2_COST} (${EXCESS_HOURS} hours beyond free tier)"
    else
        echo "  EC2 (t2.micro): \$0 (within free tier)"
    fi
else
    echo "  EC2: \$0 (no running instances)"
fi

# EBS cost (approximate)
if [ ! -z "$TOTAL_EBS" ] && [ "$TOTAL_EBS" -gt 0 ]; then
    EXCESS_EBS=$((TOTAL_EBS - 30))
    if [ $EXCESS_EBS -gt 0 ]; then
        EBS_COST=$(echo "scale=2; $EXCESS_EBS * 0.10" | bc)
        echo "  EBS Storage: ~\$${EBS_COST} (${EXCESS_EBS}GB beyond free tier)"
    else
        echo "  EBS Storage: \$0 (within free tier)"
    fi
fi

echo ""
echo "======================================"
echo -e "${BLUE}Cost Optimization Recommendations:${NC}"
echo "======================================"

if [ "$RUNNING_COUNT" -gt 0 ]; then
    echo "  1. ${YELLOW}Stop instances when not in use${NC}"
    echo "     Command: ./manage-instances.sh stop"
    echo ""
fi

if [ ! -z "$IMAGE_COUNT" ] && [ "$IMAGE_COUNT" -gt 10 ]; then
    echo "  2. ${YELLOW}Clean up old ECR images${NC}"
    echo "     Command: ./cleanup-ecr.sh"
    echo ""
fi

echo "  3. ${YELLOW}Run Docker cleanup on Jenkins${NC}"
echo "     Command: ssh into Jenkins and run ./cleanup-docker.sh"
echo ""

echo "  4. ${YELLOW}Review AWS Cost Explorer${NC}"
echo "     URL: https://console.aws.amazon.com/cost-management/home"
echo ""

echo "======================================"
echo "Report completed at $(date)"
echo "======================================"

