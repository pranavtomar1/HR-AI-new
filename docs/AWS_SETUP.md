# AWS Infrastructure Setup Guide

This guide provides step-by-step instructions for setting up the AWS infrastructure required for the CI/CD pipeline with Jenkins and Kubernetes.

## Prerequisites

- AWS Account with $100 credit (Free Tier eligible)
- AWS CLI installed and configured
- SSH key pair for EC2 access
- Basic understanding of AWS services

## Cost Estimate

**Monthly Cost: $5-15** (mostly within free tier)
- 3x EC2 t2.micro instances: Free tier (750 hours/month)
- 30GB EBS storage: Free tier
- ECR: Free tier (500MB storage)
- Data transfer: Minimal within free tier

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         AWS VPC                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Public Subnet (10.0.1.0/24)             │   │
│  │                                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │   │
│  │  │   Jenkins    │  │  K8s Master  │  │ K8s Worker│ │   │
│  │  │  (t2.micro)  │  │  (t2.micro)  │  │(t2.micro) │ │   │
│  │  └──────────────┘  └──────────────┘  └───────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Internet Gateway ←→ Route Table                            │
└─────────────────────────────────────────────────────────────┘
                          │
                    ECR Repository
```

## Step 1: Create VPC and Networking

### 1.1 Create VPC

```bash
# Set variables
export AWS_REGION=us-east-1
export VPC_CIDR=10.0.0.0/16
export SUBNET_CIDR=10.0.1.0/24

# Create VPC
VPC_ID=$(aws ec2 create-vpc \
    --cidr-block $VPC_CIDR \
    --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=hr-ai-vpc}]' \
    --region $AWS_REGION \
    --query 'Vpc.VpcId' \
    --output text)

echo "VPC ID: $VPC_ID"

# Enable DNS hostnames
aws ec2 modify-vpc-attribute \
    --vpc-id $VPC_ID \
    --enable-dns-hostnames \
    --region $AWS_REGION
```

### 1.2 Create Internet Gateway

```bash
# Create Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway \
    --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=hr-ai-igw}]' \
    --region $AWS_REGION \
    --query 'InternetGateway.InternetGatewayId' \
    --output text)

echo "Internet Gateway ID: $IGW_ID"

# Attach to VPC
aws ec2 attach-internet-gateway \
    --vpc-id $VPC_ID \
    --internet-gateway-id $IGW_ID \
    --region $AWS_REGION
```

### 1.3 Create Subnet

```bash
# Create public subnet
SUBNET_ID=$(aws ec2 create-subnet \
    --vpc-id $VPC_ID \
    --cidr-block $SUBNET_CIDR \
    --availability-zone ${AWS_REGION}a \
    --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=hr-ai-public-subnet}]' \
    --region $AWS_REGION \
    --query 'Subnet.SubnetId' \
    --output text)

echo "Subnet ID: $SUBNET_ID"

# Enable auto-assign public IP
aws ec2 modify-subnet-attribute \
    --subnet-id $SUBNET_ID \
    --map-public-ip-on-launch \
    --region $AWS_REGION
```

### 1.4 Create Route Table

```bash
# Create route table
ROUTE_TABLE_ID=$(aws ec2 create-route-table \
    --vpc-id $VPC_ID \
    --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=hr-ai-public-rt}]' \
    --region $AWS_REGION \
    --query 'RouteTable.RouteTableId' \
    --output text)

echo "Route Table ID: $ROUTE_TABLE_ID"

# Create route to Internet Gateway
aws ec2 create-route \
    --route-table-id $ROUTE_TABLE_ID \
    --destination-cidr-block 0.0.0.0/0 \
    --gateway-id $IGW_ID \
    --region $AWS_REGION

# Associate route table with subnet
aws ec2 associate-route-table \
    --subnet-id $SUBNET_ID \
    --route-table-id $ROUTE_TABLE_ID \
    --region $AWS_REGION
```

## Step 2: Create Security Groups

### 2.1 Jenkins Security Group

```bash
# Create Jenkins security group
JENKINS_SG_ID=$(aws ec2 create-security-group \
    --group-name hr-ai-jenkins-sg \
    --description "Security group for Jenkins server" \
    --vpc-id $VPC_ID \
    --region $AWS_REGION \
    --query 'GroupId' \
    --output text)

echo "Jenkins Security Group ID: $JENKINS_SG_ID"

# Allow SSH from your IP (replace YOUR_IP with your actual IP)
aws ec2 authorize-security-group-ingress \
    --group-id $JENKINS_SG_ID \
    --protocol tcp \
    --port 22 \
    --cidr 0.0.0.0/0 \
    --region $AWS_REGION

# Allow Jenkins web interface (port 8080)
aws ec2 authorize-security-group-ingress \
    --group-id $JENKINS_SG_ID \
    --protocol tcp \
    --port 8080 \
    --cidr 0.0.0.0/0 \
    --region $AWS_REGION

# Allow all traffic within VPC (for Docker, kubectl communication)
aws ec2 authorize-security-group-ingress \
    --group-id $JENKINS_SG_ID \
    --protocol -1 \
    --source-group $JENKINS_SG_ID \
    --region $AWS_REGION
```

### 2.2 Kubernetes Security Group

```bash
# Create Kubernetes security group
K8S_SG_ID=$(aws ec2 create-security-group \
    --group-name hr-ai-k8s-sg \
    --description "Security group for Kubernetes cluster" \
    --vpc-id $VPC_ID \
    --region $AWS_REGION \
    --query 'GroupId' \
    --output text)

echo "Kubernetes Security Group ID: $K8S_SG_ID"

# Allow SSH
aws ec2 authorize-security-group-ingress \
    --group-id $K8S_SG_ID \
    --protocol tcp \
    --port 22 \
    --cidr 0.0.0.0/0 \
    --region $AWS_REGION

# Allow Kubernetes API server (port 6443)
aws ec2 authorize-security-group-ingress \
    --group-id $K8S_SG_ID \
    --protocol tcp \
    --port 6443 \
    --cidr 0.0.0.0/0 \
    --region $AWS_REGION

# Allow NodePort services (30000-32767)
aws ec2 authorize-security-group-ingress \
    --group-id $K8S_SG_ID \
    --protocol tcp \
    --port 30000-32767 \
    --cidr 0.0.0.0/0 \
    --region $AWS_REGION

# Allow HTTP for application
aws ec2 authorize-security-group-ingress \
    --group-id $K8S_SG_ID \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0 \
    --region $AWS_REGION

# Allow HTTPS for application
aws ec2 authorize-security-group-ingress \
    --group-id $K8S_SG_ID \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0 \
    --region $AWS_REGION

# Allow all traffic within the security group (for pod-to-pod communication)
aws ec2 authorize-security-group-ingress \
    --group-id $K8S_SG_ID \
    --protocol -1 \
    --source-group $K8S_SG_ID \
    --region $AWS_REGION

# Allow traffic from Jenkins to Kubernetes
aws ec2 authorize-security-group-ingress \
    --group-id $K8S_SG_ID \
    --protocol -1 \
    --source-group $JENKINS_SG_ID \
    --region $AWS_REGION
```

## Step 3: Create IAM Roles and Policies

### 3.1 Create IAM Role for Jenkins EC2

```bash
# Create trust policy for EC2
cat > jenkins-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create IAM role
aws iam create-role \
    --role-name hr-ai-jenkins-role \
    --assume-role-policy-document file://jenkins-trust-policy.json

# Create policy for ECR access
cat > jenkins-ecr-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:DescribeRepositories",
        "ecr:CreateRepository",
        "ecr:ListImages"
      ],
      "Resource": "*"
    }
  ]
}
EOF

# Create and attach policy
aws iam create-policy \
    --policy-name hr-ai-jenkins-ecr-policy \
    --policy-document file://jenkins-ecr-policy.json

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Attach policy to role
aws iam attach-role-policy \
    --role-name hr-ai-jenkins-role \
    --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/hr-ai-jenkins-ecr-policy

# Create instance profile
aws iam create-instance-profile \
    --instance-profile-name hr-ai-jenkins-instance-profile

# Add role to instance profile
aws iam add-role-to-instance-profile \
    --instance-profile-name hr-ai-jenkins-instance-profile \
    --role-name hr-ai-jenkins-role
```

### 3.2 Create IAM Role for Kubernetes Nodes

```bash
# Create IAM role for Kubernetes nodes
aws iam create-role \
    --role-name hr-ai-k8s-node-role \
    --assume-role-policy-document file://jenkins-trust-policy.json

# Attach ECR read-only policy
aws iam attach-role-policy \
    --role-name hr-ai-k8s-node-role \
    --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/hr-ai-jenkins-ecr-policy

# Create instance profile for K8s nodes
aws iam create-instance-profile \
    --instance-profile-name hr-ai-k8s-node-instance-profile

# Add role to instance profile
aws iam add-role-to-instance-profile \
    --instance-profile-name hr-ai-k8s-node-instance-profile \
    --role-name hr-ai-k8s-node-role
```

## Step 4: Create EC2 Key Pair

```bash
# Create key pair for SSH access
aws ec2 create-key-pair \
    --key-name hr-ai-key \
    --region $AWS_REGION \
    --query 'KeyMaterial' \
    --output text > hr-ai-key.pem

# Set permissions
chmod 400 hr-ai-key.pem

echo "Key pair created: hr-ai-key.pem"
echo "IMPORTANT: Keep this file safe!"
```

## Step 5: Launch EC2 Instances

### 5.1 Get Latest Ubuntu AMI

```bash
# Get latest Ubuntu 22.04 LTS AMI
AMI_ID=$(aws ec2 describe-images \
    --owners 099720109477 \
    --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
    --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
    --output text \
    --region $AWS_REGION)

echo "Ubuntu AMI ID: $AMI_ID"
```

### 5.2 Launch Jenkins EC2 Instance

```bash
# Launch Jenkins instance
JENKINS_INSTANCE_ID=$(aws ec2 run-instances \
    --image-id $AMI_ID \
    --instance-type t2.micro \
    --key-name hr-ai-key \
    --security-group-ids $JENKINS_SG_ID \
    --subnet-id $SUBNET_ID \
    --iam-instance-profile Name=hr-ai-jenkins-instance-profile \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=hr-ai-jenkins}]' \
    --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=20,VolumeType=gp2}' \
    --region $AWS_REGION \
    --query 'Instances[0].InstanceId' \
    --output text)

echo "Jenkins Instance ID: $JENKINS_INSTANCE_ID"

# Wait for instance to be running
aws ec2 wait instance-running \
    --instance-ids $JENKINS_INSTANCE_ID \
    --region $AWS_REGION

# Get public IP
JENKINS_PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids $JENKINS_INSTANCE_ID \
    --region $AWS_REGION \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

echo "Jenkins Public IP: $JENKINS_PUBLIC_IP"
```

### 5.3 Launch Kubernetes Master Instance

```bash
# Launch K8s master instance
K8S_MASTER_INSTANCE_ID=$(aws ec2 run-instances \
    --image-id $AMI_ID \
    --instance-type t2.micro \
    --key-name hr-ai-key \
    --security-group-ids $K8S_SG_ID \
    --subnet-id $SUBNET_ID \
    --iam-instance-profile Name=hr-ai-k8s-node-instance-profile \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=hr-ai-k8s-master}]' \
    --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=20,VolumeType=gp2}' \
    --region $AWS_REGION \
    --query 'Instances[0].InstanceId' \
    --output text)

echo "K8s Master Instance ID: $K8S_MASTER_INSTANCE_ID"

# Wait for instance to be running
aws ec2 wait instance-running \
    --instance-ids $K8S_MASTER_INSTANCE_ID \
    --region $AWS_REGION

# Get public and private IPs
K8S_MASTER_PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids $K8S_MASTER_INSTANCE_ID \
    --region $AWS_REGION \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

K8S_MASTER_PRIVATE_IP=$(aws ec2 describe-instances \
    --instance-ids $K8S_MASTER_INSTANCE_ID \
    --region $AWS_REGION \
    --query 'Reservations[0].Instances[0].PrivateIpAddress' \
    --output text)

echo "K8s Master Public IP: $K8S_MASTER_PUBLIC_IP"
echo "K8s Master Private IP: $K8S_MASTER_PRIVATE_IP"
```

### 5.4 Launch Kubernetes Worker Instance

```bash
# Launch K8s worker instance
K8S_WORKER_INSTANCE_ID=$(aws ec2 run-instances \
    --image-id $AMI_ID \
    --instance-type t2.micro \
    --key-name hr-ai-key \
    --security-group-ids $K8S_SG_ID \
    --subnet-id $SUBNET_ID \
    --iam-instance-profile Name=hr-ai-k8s-node-instance-profile \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=hr-ai-k8s-worker}]' \
    --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=20,VolumeType=gp2}' \
    --region $AWS_REGION \
    --query 'Instances[0].InstanceId' \
    --output text)

echo "K8s Worker Instance ID: $K8S_WORKER_INSTANCE_ID"

# Wait for instance to be running
aws ec2 wait instance-running \
    --instance-ids $K8S_WORKER_INSTANCE_ID \
    --region $AWS_REGION

# Get public and private IPs
K8S_WORKER_PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids $K8S_WORKER_INSTANCE_ID \
    --region $AWS_REGION \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

K8S_WORKER_PRIVATE_IP=$(aws ec2 describe-instances \
    --instance-ids $K8S_WORKER_INSTANCE_ID \
    --region $AWS_REGION \
    --query 'Reservations[0].Instances[0].PrivateIpAddress' \
    --output text)

echo "K8s Worker Public IP: $K8S_WORKER_PUBLIC_IP"
echo "K8s Worker Private IP: $K8S_WORKER_PRIVATE_IP"
```

## Step 6: Create ECR Repository

```bash
# Create ECR repository
ECR_REPO_URI=$(aws ecr create-repository \
    --repository-name hr-ai \
    --region $AWS_REGION \
    --query 'repository.repositoryUri' \
    --output text)

echo "ECR Repository URI: $ECR_REPO_URI"

# Configure lifecycle policy to delete old images (cost optimization)
cat > ecr-lifecycle-policy.json <<EOF
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep only last 10 images",
      "selection": {
        "tagStatus": "any",
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
EOF

aws ecr put-lifecycle-policy \
    --repository-name hr-ai \
    --lifecycle-policy-text file://ecr-lifecycle-policy.json \
    --region $AWS_REGION
```

## Step 7: Save Configuration

```bash
# Create configuration file
cat > aws-infrastructure-config.txt <<EOF
=================================================
AWS Infrastructure Configuration
=================================================

Region: $AWS_REGION
AWS Account ID: $AWS_ACCOUNT_ID

VPC Configuration:
- VPC ID: $VPC_ID
- Subnet ID: $SUBNET_ID
- Internet Gateway ID: $IGW_ID
- Route Table ID: $ROUTE_TABLE_ID

Security Groups:
- Jenkins SG: $JENKINS_SG_ID
- Kubernetes SG: $K8S_SG_ID

EC2 Instances:
- Jenkins Instance: $JENKINS_INSTANCE_ID
  Public IP: $JENKINS_PUBLIC_IP
  
- K8s Master Instance: $K8S_MASTER_INSTANCE_ID
  Public IP: $K8S_MASTER_PUBLIC_IP
  Private IP: $K8S_MASTER_PRIVATE_IP
  
- K8s Worker Instance: $K8S_WORKER_INSTANCE_ID
  Public IP: $K8S_WORKER_PUBLIC_IP
  Private IP: $K8S_WORKER_PRIVATE_IP

ECR Repository:
- Repository URI: $ECR_REPO_URI

SSH Key: hr-ai-key.pem

=================================================
Next Steps:
=================================================
1. SSH into Jenkins: ssh -i hr-ai-key.pem ubuntu@$JENKINS_PUBLIC_IP
2. SSH into K8s Master: ssh -i hr-ai-key.pem ubuntu@$K8S_MASTER_PUBLIC_IP
3. SSH into K8s Worker: ssh -i hr-ai-key.pem ubuntu@$K8S_WORKER_PUBLIC_IP
4. Follow Jenkins setup guide: docs/JENKINS_SETUP.md
5. Follow K8s setup guide: docs/K8S_SETUP.md

=================================================
EOF

cat aws-infrastructure-config.txt
```

## Cost Monitoring Setup

### Set up Billing Alerts

```bash
# Create SNS topic for billing alerts
SNS_TOPIC_ARN=$(aws sns create-topic \
    --name hr-ai-billing-alerts \
    --region us-east-1 \
    --query 'TopicArn' \
    --output text)

# Subscribe your email to the topic
aws sns subscribe \
    --topic-arn $SNS_TOPIC_ARN \
    --protocol email \
    --notification-endpoint your-email@example.com \
    --region us-east-1

echo "Billing alert SNS topic created. Check your email to confirm subscription."

# Create CloudWatch alarm for billing (requires billing metrics enabled in AWS Console)
aws cloudwatch put-metric-alarm \
    --alarm-name hr-ai-billing-alert \
    --alarm-description "Alert when estimated charges exceed $50" \
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
```

## Cleanup Script (for teardown)

Save this script for when you want to tear down the infrastructure:

```bash
#!/bin/bash
# cleanup-aws-infrastructure.sh

# Load configuration
source aws-infrastructure-config.txt

# Terminate EC2 instances
aws ec2 terminate-instances --instance-ids $JENKINS_INSTANCE_ID $K8S_MASTER_INSTANCE_ID $K8S_WORKER_INSTANCE_ID --region $AWS_REGION

# Wait for instances to terminate
aws ec2 wait instance-terminated --instance-ids $JENKINS_INSTANCE_ID $K8S_MASTER_INSTANCE_ID $K8S_WORKER_INSTANCE_ID --region $AWS_REGION

# Delete ECR repository
aws ecr delete-repository --repository-name hr-ai --force --region $AWS_REGION

# Delete security groups
aws ec2 delete-security-group --group-id $JENKINS_SG_ID --region $AWS_REGION
aws ec2 delete-security-group --group-id $K8S_SG_ID --region $AWS_REGION

# Delete subnet
aws ec2 delete-subnet --subnet-id $SUBNET_ID --region $AWS_REGION

# Detach and delete internet gateway
aws ec2 detach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID --region $AWS_REGION
aws ec2 delete-internet-gateway --internet-gateway-id $IGW_ID --region $AWS_REGION

# Delete VPC
aws ec2 delete-vpc --vpc-id $VPC_ID --region $AWS_REGION

echo "Infrastructure cleanup complete!"
```

## Troubleshooting

### Instance Connection Issues

```bash
# Check instance status
aws ec2 describe-instance-status --instance-ids $JENKINS_INSTANCE_ID --region $AWS_REGION

# View system log
aws ec2 get-console-output --instance-id $JENKINS_INSTANCE_ID --region $AWS_REGION
```

### Security Group Issues

```bash
# List security group rules
aws ec2 describe-security-groups --group-ids $JENKINS_SG_ID --region $AWS_REGION
```

### IAM Role Issues

```bash
# Verify instance profile
aws ec2 describe-instances --instance-ids $JENKINS_INSTANCE_ID --query 'Reservations[0].Instances[0].IamInstanceProfile' --region $AWS_REGION
```

## Summary

After completing this guide, you will have:
- ✅ VPC with public subnet and internet gateway
- ✅ Security groups for Jenkins and Kubernetes
- ✅ IAM roles with ECR access
- ✅ 3 EC2 t2.micro instances (Jenkins, K8s master, K8s worker)
- ✅ ECR repository for Docker images
- ✅ Billing alerts configured

**Total Setup Time:** 30-45 minutes

**Next Steps:**
1. Proceed to `docs/JENKINS_SETUP.md` to install and configure Jenkins
2. Proceed to `docs/K8S_SETUP.md` to set up the Kubernetes cluster
3. Set up the CI/CD pipeline as described in the main documentation

