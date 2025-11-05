# IAM Roles and Policies Configuration

This document provides detailed IAM policies and roles for the CI/CD pipeline components.

## Overview

The infrastructure requires the following IAM configurations:
1. **Jenkins EC2 Instance Role** - For ECR access and AWS operations
2. **Kubernetes Node Roles** - For ECR image pulling
3. **Optional User Policies** - For manual infrastructure management

## 1. Jenkins EC2 Instance Role

### Trust Policy

File: `iam/jenkins-trust-policy.json`

```json
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
```

### ECR Full Access Policy

File: `iam/jenkins-ecr-policy.json`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRFullAccess",
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
        "ecr:ListImages",
        "ecr:DescribeImages",
        "ecr:DeleteRepository",
        "ecr:BatchDeleteImage",
        "ecr:SetRepositoryPolicy",
        "ecr:GetRepositoryPolicy",
        "ecr:GetLifecyclePolicy",
        "ecr:PutLifecyclePolicy"
      ],
      "Resource": "*"
    }
  ]
}
```

### Create Jenkins Role (CLI Commands)

```bash
# Set variables
export AWS_REGION=us-east-1
export ROLE_NAME=hr-ai-jenkins-role
export POLICY_NAME=hr-ai-jenkins-ecr-policy
export INSTANCE_PROFILE_NAME=hr-ai-jenkins-instance-profile

# Create trust policy file
cat > jenkins-trust-policy.json <<'EOF'
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

# Create the IAM role
aws iam create-role \
    --role-name $ROLE_NAME \
    --assume-role-policy-document file://jenkins-trust-policy.json \
    --description "IAM role for Jenkins EC2 instance with ECR access"

# Create ECR policy file
cat > jenkins-ecr-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRFullAccess",
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
        "ecr:ListImages",
        "ecr:DescribeImages",
        "ecr:DeleteRepository",
        "ecr:BatchDeleteImage",
        "ecr:SetRepositoryPolicy",
        "ecr:GetRepositoryPolicy",
        "ecr:GetLifecyclePolicy",
        "ecr:PutLifecyclePolicy"
      ],
      "Resource": "*"
    }
  ]
}
EOF

# Create and attach the policy
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws iam create-policy \
    --policy-name $POLICY_NAME \
    --policy-document file://jenkins-ecr-policy.json \
    --description "Policy for Jenkins to access ECR"

aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/$POLICY_NAME

# Create instance profile
aws iam create-instance-profile \
    --instance-profile-name $INSTANCE_PROFILE_NAME

# Add role to instance profile
aws iam add-role-to-instance-profile \
    --instance-profile-name $INSTANCE_PROFILE_NAME \
    --role-name $ROLE_NAME

echo "Jenkins IAM role created: $ROLE_NAME"
echo "Instance profile: $INSTANCE_PROFILE_NAME"
```

### Attach Role to Jenkins EC2 Instance

```bash
# Get Jenkins instance ID
JENKINS_INSTANCE_ID=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=hr-ai-jenkins" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text \
    --region $AWS_REGION)

# Associate IAM instance profile
aws ec2 associate-iam-instance-profile \
    --instance-id $JENKINS_INSTANCE_ID \
    --iam-instance-profile Name=$INSTANCE_PROFILE_NAME \
    --region $AWS_REGION

echo "IAM role attached to Jenkins instance: $JENKINS_INSTANCE_ID"
```

## 2. Kubernetes Node Role

### ECR Read-Only Policy

File: `iam/k8s-node-ecr-policy.json`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRReadAccess",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:DescribeRepositories",
        "ecr:ListImages",
        "ecr:DescribeImages"
      ],
      "Resource": "*"
    }
  ]
}
```

### Create Kubernetes Node Role

```bash
# Set variables
export K8S_ROLE_NAME=hr-ai-k8s-node-role
export K8S_POLICY_NAME=hr-ai-k8s-ecr-policy
export K8S_INSTANCE_PROFILE_NAME=hr-ai-k8s-node-instance-profile

# Create the IAM role (reuse trust policy)
aws iam create-role \
    --role-name $K8S_ROLE_NAME \
    --assume-role-policy-document file://jenkins-trust-policy.json \
    --description "IAM role for Kubernetes nodes with ECR read access"

# Create ECR read-only policy file
cat > k8s-node-ecr-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRReadAccess",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:DescribeRepositories",
        "ecr:ListImages",
        "ecr:DescribeImages"
      ],
      "Resource": "*"
    }
  ]
}
EOF

# Create and attach the policy
aws iam create-policy \
    --policy-name $K8S_POLICY_NAME \
    --policy-document file://k8s-node-ecr-policy.json \
    --description "Policy for Kubernetes nodes to pull images from ECR"

aws iam attach-role-policy \
    --role-name $K8S_ROLE_NAME \
    --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/$K8S_POLICY_NAME

# Create instance profile
aws iam create-instance-profile \
    --instance-profile-name $K8S_INSTANCE_PROFILE_NAME

# Add role to instance profile
aws iam add-role-to-instance-profile \
    --instance-profile-name $K8S_INSTANCE_PROFILE_NAME \
    --role-name $K8S_ROLE_NAME

echo "Kubernetes node IAM role created: $K8S_ROLE_NAME"
```

### Attach Role to Kubernetes Nodes

```bash
# Get K8s master instance ID
K8S_MASTER_INSTANCE_ID=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=hr-ai-k8s-master" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text \
    --region $AWS_REGION)

# Get K8s worker instance ID
K8S_WORKER_INSTANCE_ID=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=hr-ai-k8s-worker" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text \
    --region $AWS_REGION)

# Attach to master
aws ec2 associate-iam-instance-profile \
    --instance-id $K8S_MASTER_INSTANCE_ID \
    --iam-instance-profile Name=$K8S_INSTANCE_PROFILE_NAME \
    --region $AWS_REGION

# Attach to worker
aws ec2 associate-iam-instance-profile \
    --instance-id $K8S_WORKER_INSTANCE_ID \
    --iam-instance-profile Name=$K8S_INSTANCE_PROFILE_NAME \
    --region $AWS_REGION

echo "IAM role attached to Kubernetes nodes"
```

## 3. Optional: Admin User Policy

For manual infrastructure management, create an IAM user with appropriate permissions.

### Infrastructure Admin Policy

File: `iam/infra-admin-policy.json`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EC2Management",
      "Effect": "Allow",
      "Action": [
        "ec2:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ECRManagement",
      "Effect": "Allow",
      "Action": [
        "ecr:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "IAMManagement",
      "Effect": "Allow",
      "Action": [
        "iam:GetRole",
        "iam:GetRolePolicy",
        "iam:ListRoles",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:PassRole"
      ],
      "Resource": "*"
    },
    {
      "Sid": "VPCManagement",
      "Effect": "Allow",
      "Action": [
        "vpc:*"
      ],
      "Resource": "*"
    }
  ]
}
```

### Create Admin User (Optional)

```bash
# Create IAM user
export ADMIN_USER_NAME=hr-ai-admin

aws iam create-user \
    --user-name $ADMIN_USER_NAME

# Create policy
cat > infra-admin-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EC2Management",
      "Effect": "Allow",
      "Action": ["ec2:*"],
      "Resource": "*"
    },
    {
      "Sid": "ECRManagement",
      "Effect": "Allow",
      "Action": ["ecr:*"],
      "Resource": "*"
    },
    {
      "Sid": "IAMReadOnly",
      "Effect": "Allow",
      "Action": [
        "iam:GetRole",
        "iam:GetRolePolicy",
        "iam:ListRoles",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam create-policy \
    --policy-name hr-ai-infra-admin-policy \
    --policy-document file://infra-admin-policy.json

# Attach policy to user
aws iam attach-user-policy \
    --user-name $ADMIN_USER_NAME \
    --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/hr-ai-infra-admin-policy

# Create access keys
aws iam create-access-key \
    --user-name $ADMIN_USER_NAME
```

## 4. Verify IAM Configuration

### Verify Jenkins EC2 Role

```bash
# SSH into Jenkins instance
ssh -i hr-ai-key.pem ubuntu@<JENKINS_PUBLIC_IP>

# Test AWS credentials
aws sts get-caller-identity

# Expected output should show the Jenkins role
# Example:
# {
#     "UserId": "AIDAI...",
#     "Account": "123456789012",
#     "Arn": "arn:aws:sts::123456789012:assumed-role/hr-ai-jenkins-role/i-0123456789abcdef"
# }

# Test ECR access
aws ecr describe-repositories --region us-east-1

# Test ECR login
aws ecr get-login-password --region us-east-1
```

### Verify Kubernetes Node Role

```bash
# SSH into K8s master or worker
ssh -i hr-ai-key.pem ubuntu@<K8S_NODE_PUBLIC_IP>

# Test AWS credentials
aws sts get-caller-identity

# Test ECR access
aws ecr describe-repositories --region us-east-1

# Test image pull
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/hr-ai"

aws ecr get-login-password --region us-east-1 | \
    docker login --username AWS --password-stdin $ECR_REPO
```

## 5. Kubernetes Service Account for CI/CD (Advanced)

For more granular control, create a Kubernetes service account for Jenkins.

### Create Service Account

```yaml
# k8s/jenkins-service-account.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: jenkins
  namespace: hr-ai

---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: jenkins-deployer
  namespace: hr-ai
rules:
- apiGroups: ["", "apps", "extensions"]
  resources:
    - pods
    - deployments
    - services
    - configmaps
    - secrets
    - replicasets
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: [""]
  resources:
    - pods/log
  verbs: ["get", "list"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: jenkins-deployer-binding
  namespace: hr-ai
subjects:
- kind: ServiceAccount
  name: jenkins
  namespace: hr-ai
roleRef:
  kind: Role
  name: jenkins-deployer
  apiGroup: rbac.authorization.k8s.io
```

Apply the service account:

```bash
kubectl apply -f k8s/jenkins-service-account.yaml
```

## 6. Security Best Practices

### Principle of Least Privilege

1. **Jenkins Role**: Only needs ECR push/pull access, not full AWS admin
2. **K8s Nodes**: Only need ECR pull access, not push
3. **Service Accounts**: Limit to specific namespace and resources

### Credential Rotation

```bash
# Rotate access keys regularly (if using IAM users)
aws iam create-access-key --user-name hr-ai-admin
aws iam delete-access-key --user-name hr-ai-admin --access-key-id OLD_KEY_ID

# Instance roles automatically rotate credentials
# No manual rotation needed
```

### Audit IAM Usage

```bash
# List roles
aws iam list-roles | grep hr-ai

# List policies
aws iam list-policies --scope Local | grep hr-ai

# Get role details
aws iam get-role --role-name hr-ai-jenkins-role

# List attached policies
aws iam list-attached-role-policies --role-name hr-ai-jenkins-role
```

## 7. Troubleshooting IAM Issues

### Permission Denied Errors

```bash
# Check if role is attached to instance
aws ec2 describe-instances --instance-ids <INSTANCE_ID> \
    --query 'Reservations[0].Instances[0].IamInstanceProfile'

# Check instance metadata (from within EC2)
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/

# Check role policies
aws iam list-attached-role-policies --role-name hr-ai-jenkins-role
aws iam get-policy-version \
    --policy-arn <POLICY_ARN> \
    --version-id v1
```

### ECR Authentication Failed

```bash
# Verify ECR permissions in policy
aws iam get-policy-version \
    --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/hr-ai-jenkins-ecr-policy \
    --version-id v1

# Test ECR login manually
aws ecr get-login-password --region us-east-1 | \
    docker login --username AWS --password-stdin ${ECR_REPO}
```

### Role Not Assuming

```bash
# Check trust policy
aws iam get-role --role-name hr-ai-jenkins-role \
    --query 'Role.AssumeRolePolicyDocument'

# Ensure EC2 service is in the trust policy
```

## 8. Cleanup IAM Resources

When tearing down infrastructure:

```bash
# Detach policies from roles
aws iam detach-role-policy \
    --role-name hr-ai-jenkins-role \
    --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/hr-ai-jenkins-ecr-policy

aws iam detach-role-policy \
    --role-name hr-ai-k8s-node-role \
    --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/hr-ai-k8s-ecr-policy

# Remove roles from instance profiles
aws iam remove-role-from-instance-profile \
    --instance-profile-name hr-ai-jenkins-instance-profile \
    --role-name hr-ai-jenkins-role

aws iam remove-role-from-instance-profile \
    --instance-profile-name hr-ai-k8s-node-instance-profile \
    --role-name hr-ai-k8s-node-role

# Delete instance profiles
aws iam delete-instance-profile \
    --instance-profile-name hr-ai-jenkins-instance-profile

aws iam delete-instance-profile \
    --instance-profile-name hr-ai-k8s-node-instance-profile

# Delete roles
aws iam delete-role --role-name hr-ai-jenkins-role
aws iam delete-role --role-name hr-ai-k8s-node-role

# Delete policies
aws iam delete-policy \
    --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/hr-ai-jenkins-ecr-policy

aws iam delete-policy \
    --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/hr-ai-k8s-ecr-policy
```

## Summary

After completing this guide, you will have:
- ✅ Jenkins EC2 role with ECR push/pull access
- ✅ Kubernetes node roles with ECR pull access
- ✅ Proper IAM instance profiles attached to EC2 instances
- ✅ Service account for granular Kubernetes RBAC (optional)
- ✅ Secure, least-privilege access configuration

**Important Notes:**
- Always use IAM roles for EC2 instances instead of access keys
- Regularly audit IAM policies and permissions
- Follow the principle of least privilege
- Use AWS CloudTrail to monitor IAM actions

