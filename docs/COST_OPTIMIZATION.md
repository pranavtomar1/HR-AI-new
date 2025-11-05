# Cost Monitoring and Optimization Guide

This guide provides strategies and best practices for monitoring and optimizing costs when running the CI/CD infrastructure on AWS Free Tier with a $100 credit.

## Cost Breakdown

### Free Tier Limits (12 months)

| Service | Free Tier Limit | Estimated Usage | Status |
|---------|----------------|-----------------|---------|
| EC2 (t2.micro) | 750 hours/month | 2,190 hours (3 instances × 730 hours) | ⚠️ Exceeds by 2x |
| EBS Storage | 30 GB | 60 GB (3 × 20 GB) | ⚠️ Exceeds by 2x |
| ECR Storage | 500 MB | ~200 MB (estimated) | ✅ Within limit |
| Data Transfer (Out) | 100 GB/month | ~5 GB (estimated) | ✅ Within limit |
| VPC | Free | Included | ✅ Free |

### Monthly Cost Estimate

**Scenario 1: All instances running 24/7**
- EC2 instances: 2 additional t2.micro (beyond free tier) = ~$7-10/month
- Additional EBS storage: 30 GB = ~$3/month
- Data transfer: ~$0.50/month
- **Total: $10-15/month** ✅ Within $100 credit

**Scenario 2: Instances running only during work hours (8 hrs/day)**
- EC2 cost: $2-3/month
- EBS storage: ~$3/month
- Data transfer: ~$0.50/month
- **Total: $5-7/month** ✅ Highly cost-effective

**Scenario 3: Development (stop instances when not in use)**
- EC2 cost: $1-2/month
- EBS storage: ~$3/month (charged even when stopped)
- Data transfer: ~$0.20/month
- **Total: $4-6/month** ✅ Most economical

## 1. AWS Cost Monitoring Setup

### Set Up Billing Alerts

#### Via AWS Console:

1. **Enable Billing Alerts**
   - Go to AWS Console → Billing Dashboard
   - Click "Billing Preferences"
   - Check "Receive Billing Alerts"
   - Enter your email address
   - Save preferences

2. **Create CloudWatch Alarm**
   ```bash
   # Create SNS topic for billing alerts
   SNS_TOPIC_ARN=$(aws sns create-topic \
       --name hr-ai-billing-alerts \
       --region us-east-1 \
       --query 'TopicArn' \
       --output text)
   
   echo "SNS Topic ARN: $SNS_TOPIC_ARN"
   
   # Subscribe your email
   aws sns subscribe \
       --topic-arn $SNS_TOPIC_ARN \
       --protocol email \
       --notification-endpoint your-email@example.com \
       --region us-east-1
   
   # Confirm subscription via email
   
   # Create billing alarm for $50 threshold
   aws cloudwatch put-metric-alarm \
       --alarm-name hr-ai-billing-50-alert \
       --alarm-description "Alert when charges exceed $50" \
       --metric-name EstimatedCharges \
       --namespace AWS/Billing \
       --statistic Maximum \
       --period 21600 \
       --evaluation-periods 1 \
       --threshold 50 \
       --comparison-operator GreaterThanThreshold \
       --alarm-actions $SNS_TOPIC_ARN \
       --dimensions Name=Currency,Value=USD \
       --region us-east-1
   
   # Create alarm for $80 (warning before credit exhaustion)
   aws cloudwatch put-metric-alarm \
       --alarm-name hr-ai-billing-80-alert \
       --alarm-description "CRITICAL: Alert when charges exceed $80" \
       --metric-name EstimatedCharges \
       --namespace AWS/Billing \
       --statistic Maximum \
       --period 21600 \
       --evaluation-periods 1 \
       --threshold 80 \
       --comparison-operator GreaterThanThreshold \
       --alarm-actions $SNS_TOPIC_ARN \
       --dimensions Name=Currency,Value=USD \
       --region us-east-1
   ```

### Enable AWS Cost Explorer

```bash
# Cost Explorer provides detailed cost analysis
# Enable via AWS Console: Billing → Cost Explorer → Enable Cost Explorer
# Free for all AWS accounts
```

### Set Up Budget

```bash
# Create a monthly budget
cat > budget.json <<'EOF'
{
  "BudgetName": "hr-ai-monthly-budget",
  "BudgetLimit": {
    "Amount": "15",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
EOF

cat > notifications.json <<'EOF'
[
  {
    "NotificationType": "ACTUAL",
    "ComparisonOperator": "GREATER_THAN",
    "Threshold": 80,
    "ThresholdType": "PERCENTAGE",
    "NotificationState": "ALARM"
  },
  {
    "NotificationType": "FORECASTED",
    "ComparisonOperator": "GREATER_THAN",
    "Threshold": 100,
    "ThresholdType": "PERCENTAGE",
    "NotificationState": "ALARM"
  }
]
EOF

# Note: Budget creation requires budgets API access
# Easier to create via AWS Console: Billing → Budgets → Create Budget
```

## 2. Cost Optimization Strategies

### Strategy 1: Stop Instances When Not in Use (Recommended for Dev/Test)

#### Automated Start/Stop Script

```bash
#!/bin/bash
# scripts/manage-instances.sh
# Manage EC2 instances to save costs

ACTION=$1  # start or stop
REGION="us-east-1"

if [ -z "$ACTION" ]; then
    echo "Usage: $0 [start|stop]"
    exit 1
fi

# Get instance IDs
INSTANCE_IDS=$(aws ec2 describe-instances \
    --filters "Name=tag:Project,Values=hr-ai" \
              "Name=instance-state-name,Values=running,stopped" \
    --query 'Reservations[*].Instances[*].InstanceId' \
    --output text \
    --region $REGION)

if [ "$ACTION" == "stop" ]; then
    echo "Stopping instances: $INSTANCE_IDS"
    aws ec2 stop-instances --instance-ids $INSTANCE_IDS --region $REGION
    echo "Instances stopped. This saves EC2 compute costs."
    echo "Note: EBS storage costs still apply."
elif [ "$ACTION" == "start" ]; then
    echo "Starting instances: $INSTANCE_IDS"
    aws ec2 start-instances --instance-ids $INSTANCE_IDS --region $REGION
    echo "Instances started. Wait for them to be in running state."
else
    echo "Invalid action. Use 'start' or 'stop'."
    exit 1
fi
```

#### Scheduled Start/Stop with Lambda (Advanced)

Create Lambda functions to automatically start instances at 8 AM and stop at 6 PM on weekdays.

```python
# lambda/stop_instances.py
import boto3
import os

ec2 = boto3.client('ec2', region_name='us-east-1')

def lambda_handler(event, context):
    # Get instances with Project=hr-ai tag
    instances = ec2.describe_instances(
        Filters=[
            {'Name': 'tag:Project', 'Values': ['hr-ai']},
            {'Name': 'instance-state-name', 'Values': ['running']}
        ]
    )
    
    instance_ids = []
    for reservation in instances['Reservations']:
        for instance in reservation['Instances']:
            instance_ids.append(instance['InstanceId'])
    
    if instance_ids:
        ec2.stop_instances(InstanceIds=instance_ids)
        print(f'Stopped instances: {instance_ids}')
    else:
        print('No running instances to stop')
    
    return {'statusCode': 200, 'body': 'Success'}
```

### Strategy 2: Clean Up Unused Resources

#### ECR Image Cleanup Script

```bash
#!/bin/bash
# scripts/cleanup-ecr.sh
# Remove old Docker images from ECR

REPO_NAME="hr-ai"
REGION="us-east-1"
KEEP_COUNT=10  # Keep last 10 images

echo "Cleaning up ECR repository: $REPO_NAME"

# Get all images sorted by push date
IMAGES=$(aws ecr describe-images \
    --repository-name $REPO_NAME \
    --region $REGION \
    --query 'sort_by(imageDetails,& imagePushedAt)[*].imageDigest' \
    --output text)

# Count images
TOTAL_IMAGES=$(echo $IMAGES | wc -w)
echo "Total images: $TOTAL_IMAGES"

if [ $TOTAL_IMAGES -gt $KEEP_COUNT ]; then
    DELETE_COUNT=$((TOTAL_IMAGES - KEEP_COUNT))
    echo "Deleting $DELETE_COUNT old images..."
    
    # Get images to delete (oldest ones)
    IMAGES_TO_DELETE=$(echo $IMAGES | tr ' ' '\n' | head -n $DELETE_COUNT)
    
    for digest in $IMAGES_TO_DELETE; do
        echo "Deleting image: $digest"
        aws ecr batch-delete-image \
            --repository-name $REPO_NAME \
            --image-ids imageDigest=$digest \
            --region $REGION
    done
    
    echo "Cleanup complete!"
else
    echo "No cleanup needed. Image count ($TOTAL_IMAGES) is within limit ($KEEP_COUNT)."
fi
```

#### Docker System Cleanup (On Jenkins)

```bash
#!/bin/bash
# Run on Jenkins server to clean up Docker
# scripts/cleanup-docker.sh

echo "Cleaning up Docker system..."

# Remove unused containers
docker container prune -f

# Remove unused images
docker image prune -a -f

# Remove unused volumes
docker volume prune -f

# Remove build cache
docker builder prune -f

# Show disk usage
echo "Current Docker disk usage:"
docker system df

echo "Cleanup complete!"
```

Schedule this script in Jenkins or as a cron job:
```bash
# Add to crontab on Jenkins server
# Run cleanup every Sunday at 2 AM
0 2 * * 0 /path/to/cleanup-docker.sh
```

### Strategy 3: Optimize Instance Usage

#### Use t2.micro Burst Credits Wisely

```bash
# Monitor CPU credit balance
aws cloudwatch get-metric-statistics \
    --namespace AWS/EC2 \
    --metric-name CPUCreditBalance \
    --dimensions Name=InstanceId,Value=<INSTANCE_ID> \
    --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Average \
    --region us-east-1
```

#### Optimize Kubernetes Resource Requests

Already configured in `k8s/deployment.yaml`:
```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"
```

These conservative limits ensure pods don't consume too many resources on t2.micro instances.

### Strategy 4: Use Single Availability Zone

Already implemented in our setup:
- All instances in one AZ saves on data transfer costs
- No cross-AZ traffic charges

### Strategy 5: Optimize Build Process

#### Cache Docker Layers in Jenkins

Add to Jenkinsfile (already implemented):
```groovy
// Docker automatically caches layers
// Ensure Dockerfile is optimized for caching
```

#### Reduce Build Frequency

```groovy
// In Jenkinsfile, optimize polling
triggers {
    pollSCM('H/15 * * * *')  // Every 15 minutes instead of 5
}
```

## 3. Cost Monitoring Dashboard

### Create Cost Monitoring Script

```bash
#!/bin/bash
# scripts/check-costs.sh
# Check current month's AWS costs

REGION="us-east-1"
START_DATE=$(date -u +%Y-%m-01)
END_DATE=$(date -u +%Y-%m-%d)

echo "======================================"
echo "AWS Cost Report"
echo "Period: $START_DATE to $END_DATE"
echo "======================================"

# Get current month costs (requires Cost Explorer API)
# Note: Cost Explorer API has a delay of 24 hours

echo ""
echo "Running Resources:"
echo "------------------------------------"

# List running EC2 instances
aws ec2 describe-instances \
    --filters "Name=instance-state-name,Values=running" \
    --query 'Reservations[*].Instances[*].[InstanceId,InstanceType,Tags[?Key==`Name`].Value|[0],LaunchTime]' \
    --output table \
    --region $REGION

echo ""
echo "EBS Volumes:"
echo "------------------------------------"
aws ec2 describe-volumes \
    --query 'Volumes[*].[VolumeId,Size,State,VolumeType]' \
    --output table \
    --region $REGION

echo ""
echo "ECR Repositories:"
echo "------------------------------------"
aws ecr describe-repositories \
    --query 'repositories[*].[repositoryName,repositoryUri]' \
    --output table \
    --region $REGION

# Get ECR repository size
REPO_SIZE=$(aws ecr describe-images \
    --repository-name hr-ai \
    --region $REGION \
    --query 'imageDetails[*].imageSizeInBytes' \
    --output text 2>/dev/null | awk '{sum+=$1} END {print sum/1024/1024}')

if [ ! -z "$REPO_SIZE" ]; then
    echo "ECR Repository Size: ${REPO_SIZE} MB"
fi

echo ""
echo "Billing Alarms:"
echo "------------------------------------"
aws cloudwatch describe-alarms \
    --alarm-name-prefix "hr-ai-billing" \
    --query 'MetricAlarms[*].[AlarmName,StateValue,Threshold]' \
    --output table \
    --region us-east-1

echo ""
echo "======================================"
echo "Cost Optimization Recommendations:"
echo "======================================"
echo "1. Stop instances when not in use"
echo "2. Delete old ECR images (run cleanup-ecr.sh)"
echo "3. Clean up Docker images on Jenkins (run cleanup-docker.sh)"
echo "4. Monitor AWS Cost Explorer for detailed breakdown"
echo "======================================"
```

Make it executable and run weekly:
```bash
chmod +x scripts/check-costs.sh

# Add to crontab for weekly report
# Every Monday at 9 AM
0 9 * * 1 /path/to/check-costs.sh | mail -s "Weekly AWS Cost Report" your-email@example.com
```

## 4. Resource Tagging Strategy

Tag all resources for better cost allocation:

```bash
# Tag EC2 instances
aws ec2 create-tags \
    --resources <INSTANCE_ID> \
    --tags Key=Project,Value=hr-ai Key=Environment,Value=development \
    --region us-east-1

# Tag ECR repository (via AWS Console)
# Tags: Project=hr-ai, Environment=development, CostCenter=dev-ops
```

## 5. Cost Optimization Checklist

### Daily
- [ ] Check running instances are necessary
- [ ] Monitor build job execution times

### Weekly
- [ ] Review AWS Cost Explorer
- [ ] Run cost monitoring script
- [ ] Clean up old Docker images
- [ ] Check ECR repository size

### Monthly
- [ ] Review total AWS bill
- [ ] Analyze cost trends
- [ ] Optimize resource allocation
- [ ] Clean up unused resources
- [ ] Review and adjust budgets

## 6. Emergency Cost Reduction

If costs approach $100 credit:

1. **Immediate Actions**
   ```bash
   # Stop all instances
   aws ec2 stop-instances --instance-ids $(aws ec2 describe-instances \
       --filters "Name=tag:Project,Values=hr-ai" \
       --query 'Reservations[*].Instances[*].InstanceId' \
       --output text) --region us-east-1
   
   # Delete old ECR images
   ./scripts/cleanup-ecr.sh
   
   # Delete snapshots (if any)
   aws ec2 describe-snapshots --owner-ids self --region us-east-1
   ```

2. **Consider Consolidation**
   - Run Kubernetes on 2 nodes instead of 3
   - Run Jenkins on the Kubernetes master (not recommended for production)
   - Use minikube locally for testing

3. **Use Local Development**
   - Test locally with Docker Compose
   - Only deploy to AWS for final testing/demo

## 7. Cost vs. Feature Trade-offs

### Current Setup (Recommended)
- **Cost**: $10-15/month
- **Features**: Full CI/CD, HA with 2 replicas, separate Jenkins
- **Best for**: Learning, demos, portfolio projects

### Minimal Setup (Ultra-budget)
- **Cost**: $5-7/month
- **Changes**: Single-node K8s, 1 replica, stop when not in use
- **Best for**: Occasional use, testing

### Local Development (Zero cost)
- **Cost**: $0
- **Setup**: Docker Compose locally, deploy to AWS occasionally
- **Best for**: Development phase

## 8. Estimating Total Cost Over Time

### 3-Month Projection

| Scenario | Month 1 | Month 2 | Month 3 | Total |
|----------|---------|---------|---------|-------|
| 24/7 Running | $12 | $12 | $12 | $36 |
| Work Hours Only | $6 | $6 | $6 | $18 |
| Occasional Use | $5 | $5 | $5 | $15 |

**Conclusion**: With $100 credit, all scenarios are sustainable for 6+ months.

### Cost After Free Tier Expires (Month 13+)

| Resource | Monthly Cost |
|----------|--------------|
| 3x t2.micro (24/7) | $30 |
| 60 GB EBS | $6 |
| ECR + Data Transfer | $2 |
| **Total** | **$38/month** |

**Recommendation**: Minimize costs before free tier ends or migrate to a single-node setup.

## 9. Alternative Cost-Saving Options

### Option 1: AWS Educate / Student Credits
- Apply for AWS Educate for additional credits
- GitHub Student Developer Pack includes AWS credits

### Option 2: Use AWS Spot Instances
- Save up to 70% on EC2 costs
- Not covered in this guide (requires additional configuration)

### Option 3: Migrate to Lighter Services
- Use AWS ECS Fargate (pay per task execution)
- Use AWS App Runner (simpler, potentially cheaper)
- Use AWS Lightsail (fixed pricing, simpler)

### Option 4: Multi-Cloud Strategy
- Use free tiers from other providers (GCP, Azure)
- Rotate between providers for extended free usage

## 10. Monitoring Tools

### AWS Native Tools (Free)
- AWS Cost Explorer
- AWS Budgets
- CloudWatch Billing Alarms
- AWS Cost Anomaly Detection

### Third-Party Tools (Optional)
- Kubecost (for Kubernetes cost monitoring)
- Infracost (for IaC cost estimation)
- CloudHealth / CloudCheckr (enterprise)

## Summary

**Expected Monthly Cost**: $5-15 (within $100 credit for 6+ months)

**Key Strategies**:
1. ✅ Set up billing alerts immediately
2. ✅ Stop instances when not in use
3. ✅ Clean up old Docker images regularly
4. ✅ Monitor costs weekly
5. ✅ Use efficient resource limits

**Cost Breakdown**:
- EC2: $7-10/month (beyond free tier)
- EBS: $3/month
- ECR: Free (within 500MB)
- Data Transfer: <$1/month
- **Total: $10-15/month** (mostly covered by free tier)

With proper monitoring and optimization, your $100 credit should last **6-10 months** for this project!

