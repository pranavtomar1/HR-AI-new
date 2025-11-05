#!/bin/bash
# Manage EC2 instances to save costs
# Usage: ./manage-instances.sh [start|stop|status]

ACTION=$1
REGION="us-east-1"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

if [ -z "$ACTION" ]; then
    echo "Usage: $0 [start|stop|status]"
    echo ""
    echo "Commands:"
    echo "  start  - Start all HR-AI instances"
    echo "  stop   - Stop all HR-AI instances (saves EC2 costs)"
    echo "  status - Show current instance status"
    exit 1
fi

# Get instance IDs and details
INSTANCES=$(aws ec2 describe-instances \
    --filters "Name=tag:Project,Values=hr-ai" \
              "Name=instance-state-name,Values=running,stopped,stopping,pending" \
    --query 'Reservations[*].Instances[*].[InstanceId,Tags[?Key==`Name`].Value|[0],State.Name,InstanceType,PublicIpAddress]' \
    --output text \
    --region $REGION)

if [ -z "$INSTANCES" ]; then
    echo -e "${RED}No HR-AI instances found${NC}"
    exit 1
fi

# Get just the instance IDs
INSTANCE_IDS=$(echo "$INSTANCES" | awk '{print $1}')

case $ACTION in
    status)
        echo "======================================"
        echo "HR-AI Instance Status"
        echo "======================================"
        echo "$INSTANCES" | while read -r line; do
            ID=$(echo $line | awk '{print $1}')
            NAME=$(echo $line | awk '{print $2}')
            STATE=$(echo $line | awk '{print $3}')
            TYPE=$(echo $line | awk '{print $4}')
            IP=$(echo $line | awk '{print $5}')
            
            if [ "$STATE" == "running" ]; then
                COLOR=$GREEN
            elif [ "$STATE" == "stopped" ]; then
                COLOR=$YELLOW
            else
                COLOR=$NC
            fi
            
            echo -e "${COLOR}$NAME ($ID)${NC}"
            echo "  State: $STATE"
            echo "  Type: $TYPE"
            echo "  IP: ${IP:-N/A}"
            echo ""
        done
        echo "======================================"
        ;;
        
    stop)
        echo -e "${YELLOW}Stopping instances...${NC}"
        echo "$INSTANCES" | while read -r line; do
            NAME=$(echo $line | awk '{print $2}')
            STATE=$(echo $line | awk '{print $3}')
            echo "  - $NAME ($STATE)"
        done
        echo ""
        
        RUNNING_IDS=$(aws ec2 describe-instances \
            --filters "Name=tag:Project,Values=hr-ai" \
                      "Name=instance-state-name,Values=running" \
            --query 'Reservations[*].Instances[*].InstanceId' \
            --output text \
            --region $REGION)
        
        if [ -z "$RUNNING_IDS" ]; then
            echo -e "${GREEN}All instances are already stopped${NC}"
            exit 0
        fi
        
        aws ec2 stop-instances --instance-ids $RUNNING_IDS --region $REGION > /dev/null
        
        echo -e "${GREEN}✓ Instances stopped successfully${NC}"
        echo ""
        echo "Cost savings:"
        echo "  - EC2 compute charges: Paused"
        echo "  - EBS storage charges: Continue (charged even when stopped)"
        echo ""
        echo "To start instances again, run: $0 start"
        ;;
        
    start)
        echo -e "${GREEN}Starting instances...${NC}"
        echo "$INSTANCES" | while read -r line; do
            NAME=$(echo $line | awk '{print $2}')
            STATE=$(echo $line | awk '{print $3}')
            echo "  - $NAME ($STATE)"
        done
        echo ""
        
        STOPPED_IDS=$(aws ec2 describe-instances \
            --filters "Name=tag:Project,Values=hr-ai" \
                      "Name=instance-state-name,Values=stopped" \
            --query 'Reservations[*].Instances[*].InstanceId' \
            --output text \
            --region $REGION)
        
        if [ -z "$STOPPED_IDS" ]; then
            echo -e "${GREEN}All instances are already running${NC}"
            exit 0
        fi
        
        aws ec2 start-instances --instance-ids $STOPPED_IDS --region $REGION > /dev/null
        
        echo -e "${GREEN}✓ Instances started successfully${NC}"
        echo ""
        echo "Waiting for instances to be running..."
        aws ec2 wait instance-running --instance-ids $STOPPED_IDS --region $REGION
        
        echo -e "${GREEN}✓ All instances are now running${NC}"
        echo ""
        echo "Run '$0 status' to see instance details"
        ;;
        
    *)
        echo -e "${RED}Invalid action: $ACTION${NC}"
        echo "Use: start, stop, or status"
        exit 1
        ;;
esac

