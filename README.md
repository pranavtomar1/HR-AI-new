# HR-AI CI/CD Pipeline Project

A complete CI/CD pipeline implementation for deploying a Dockerized Node.js application to Kubernetes on AWS using Jenkins.

## 🚀 Project Overview

This project demonstrates a production-ready CI/CD pipeline that:
- Builds Docker images from source code
- Pushes images to Amazon ECR (Elastic Container Registry)
- Deploys to a self-managed Kubernetes cluster on AWS EC2
- Runs entirely within AWS Free Tier limits (~$10-15/month)

## 📋 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          AWS Cloud                               │
│                                                                   │
│  ┌──────────────┐         ┌─────────────────────────────────┐  │
│  │   Jenkins    │         │    Kubernetes Cluster            │  │
│  │  (t2.micro)  │────────▶│                                  │  │
│  │              │         │  ┌──────────┐    ┌──────────┐   │  │
│  │  - Build     │         │  │  Master  │    │  Worker  │   │  │
│  │  - Test      │         │  │(t2.micro)│    │(t2.micro)│   │  │
│  │  - Deploy    │         │  └──────────┘    └──────────┘   │  │
│  └──────────────┘         │                                  │  │
│         │                  └─────────────────────────────────┘  │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │     ECR      │                                               │
│  │   (Docker    │                                               │
│  │   Registry)  │                                               │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Features

- ✅ **Automated CI/CD**: Jenkins pipeline with automated building, testing, and deployment
- ✅ **Container Orchestration**: Kubernetes with rolling updates and health checks
- ✅ **Cloud-Native**: Fully deployed on AWS using industry-standard practices
- ✅ **Cost-Effective**: Optimized for AWS Free Tier (~$10-15/month)
- ✅ **Production-Ready**: Includes monitoring, logging, and rollback capabilities
- ✅ **Infrastructure as Code**: All configurations are version-controlled

## 📁 Project Structure

```
HR-AI/
├── docs/                          # Documentation
│   ├── AWS_SETUP.md              # AWS infrastructure setup guide
│   ├── K8S_SETUP.md              # Kubernetes cluster setup guide
│   ├── JENKINS_SETUP.md          # Jenkins configuration guide
│   ├── IAM_POLICIES.md           # IAM roles and policies
│   └── COST_OPTIMIZATION.md      # Cost monitoring and optimization
├── scripts/                       # Automation scripts
│   ├── setup-k8s-master.sh       # Kubernetes master setup
│   ├── setup-k8s-worker.sh       # Kubernetes worker setup
│   ├── setup-jenkins.sh          # Jenkins installation script
│   ├── manage-instances.sh       # Start/stop EC2 instances
│   ├── cleanup-ecr.sh            # ECR image cleanup
│   ├── cleanup-docker.sh         # Docker system cleanup
│   └── check-costs.sh            # Cost monitoring script
├── k8s/                          # Kubernetes manifests
│   ├── namespace.yaml            # Application namespace
│   ├── deployment.yaml           # Deployment configuration
│   ├── service.yaml              # Service configuration
│   ├── configmap.yaml            # Application configuration
│   └── jenkins-service-account.yaml  # RBAC for Jenkins
├── iam/                          # IAM policy files
│   ├── jenkins-trust-policy.json
│   ├── jenkins-ecr-policy.json
│   └── k8s-node-ecr-policy.json
├── Dockerfile                    # Docker image definition
├── Jenkinsfile                   # CI/CD pipeline definition
├── docker-compose.yml            # Local development setup
└── README.md                     # This file
```

## 🛠️ Technology Stack

- **Application**: Node.js (static web server)
- **Containerization**: Docker
- **Container Registry**: Amazon ECR
- **Orchestration**: Kubernetes (self-managed with kubeadm)
- **CI/CD**: Jenkins
- **Cloud Provider**: AWS (EC2, VPC, ECR)
- **Infrastructure**: 3x t2.micro instances (free tier eligible)

## 📖 Quick Start Guide

### Prerequisites

- AWS Account with $100 credit (Free Tier)
- AWS CLI installed and configured
- SSH key pair for EC2 access
- Basic knowledge of Docker, Kubernetes, and AWS

### Step 1: Set Up AWS Infrastructure

Follow the detailed guide in `docs/AWS_SETUP.md` to:
1. Create VPC and networking
2. Set up security groups
3. Launch EC2 instances (Jenkins, K8s master, K8s worker)
4. Create ECR repository
5. Configure IAM roles

**Estimated time**: 30-45 minutes

```bash
# Quick setup (automated)
# See docs/AWS_SETUP.md for complete commands
```

### Step 2: Set Up Kubernetes Cluster

Follow the guide in `docs/K8S_SETUP.md` to:
1. Configure master node
2. Set up worker node(s)
3. Install CNI plugin (Flannel)
4. Configure kubectl access

**Estimated time**: 30-45 minutes

```bash
# On master node
chmod +x scripts/setup-k8s-master.sh
./scripts/setup-k8s-master.sh

# On worker node
chmod +x scripts/setup-k8s-worker.sh
./scripts/setup-k8s-worker.sh
```

### Step 3: Set Up Jenkins

Follow the guide in `docs/JENKINS_SETUP.md` to:
1. Install Jenkins
2. Configure required plugins
3. Set up credentials
4. Create pipeline job

**Estimated time**: 30-45 minutes

```bash
# On Jenkins server
chmod +x scripts/setup-jenkins.sh
./scripts/setup-jenkins.sh
```

### Step 4: Deploy Application

1. Configure GitHub webhook (optional)
2. Trigger Jenkins pipeline
3. Verify deployment on Kubernetes

```bash
# Access Jenkins UI
http://<JENKINS_PUBLIC_IP>:8080

# Build the pipeline
# Jenkins will automatically:
# 1. Build Docker image
# 2. Push to ECR
# 3. Deploy to Kubernetes
```

### Step 5: Access Your Application

```bash
# Get the NodePort
kubectl get service hr-ai-service -n hr-ai

# Access via any Kubernetes node
http://<K8S_NODE_IP>:<NODE_PORT>
```

## 💰 Cost Management

### Monthly Cost Estimate

| Resource | Cost |
|----------|------|
| EC2 (3x t2.micro 24/7) | $7-10 |
| EBS Storage (60GB) | $3 |
| ECR Storage | Free* |
| Data Transfer | <$1 |
| **Total** | **$10-15/month** |

*Within free tier (500MB)

### Cost Optimization

```bash
# Stop instances when not in use (saves ~60%)
./scripts/manage-instances.sh stop

# Clean up old Docker images
./scripts/cleanup-ecr.sh

# Monitor costs
./scripts/check-costs.sh
```

See `docs/COST_OPTIMIZATION.md` for detailed strategies.

## 🔐 Security Best Practices

1. ✅ Use IAM roles instead of access keys
2. ✅ Security groups with minimal required ports
3. ✅ Regular security updates on EC2 instances
4. ✅ RBAC configured for Kubernetes
5. ✅ Secrets managed through Kubernetes secrets
6. ✅ ECR images scanned for vulnerabilities

## 📊 Monitoring & Maintenance

### Daily Checks
- Monitor Jenkins builds
- Check application health

### Weekly Maintenance
- Run cost monitoring script
- Clean up old Docker images
- Review AWS Cost Explorer

### Monthly Tasks
- Update Jenkins and plugins
- Update Kubernetes components
- Review and optimize resources
- Security updates

```bash
# Weekly cost check
./scripts/check-costs.sh

# Clean up resources
./scripts/cleanup-ecr.sh
./scripts/cleanup-docker.sh  # Run on Jenkins server
```

## 🔧 Troubleshooting

### Common Issues

**Jenkins can't connect to Kubernetes:**
```bash
# Verify kubeconfig on Jenkins
sudo -u jenkins kubectl get nodes
```

**ECR authentication fails:**
```bash
# Test AWS credentials
aws sts get-caller-identity
```

**Pods not starting:**
```bash
# Check pod logs
kubectl logs <pod-name> -n hr-ai
kubectl describe pod <pod-name> -n hr-ai
```

See individual documentation files for detailed troubleshooting guides.

## 📚 Documentation

- [AWS Infrastructure Setup](docs/AWS_SETUP.md) - Complete AWS setup guide
- [Kubernetes Setup](docs/K8S_SETUP.md) - Kubernetes cluster configuration
- [Jenkins Setup](docs/JENKINS_SETUP.md) - Jenkins installation and configuration
- [IAM Policies](docs/IAM_POLICIES.md) - IAM roles and permissions
- [Cost Optimization](docs/COST_OPTIMIZATION.md) - Cost monitoring and saving strategies

## 🚦 CI/CD Pipeline Stages

1. **Checkout**: Clone source code from GitHub
2. **Build**: Build Docker image
3. **Push**: Push image to Amazon ECR
4. **Update Manifests**: Update Kubernetes deployment with new image
5. **Deploy**: Apply manifests to Kubernetes cluster
6. **Verify**: Check deployment status and pod health
7. **Health Check**: Validate application is running

## 🎓 Learning Outcomes

This project demonstrates proficiency in:
- Docker containerization
- Kubernetes orchestration
- CI/CD pipeline implementation
- AWS cloud infrastructure
- Infrastructure as Code
- DevOps best practices
- Cost optimization strategies
- Security configurations

## 📝 Future Enhancements

- [ ] Implement Helm charts for easier deployment
- [ ] Add monitoring with Prometheus and Grafana
- [ ] Set up centralized logging (ELK stack)
- [ ] Implement blue-green deployments
- [ ] Add automated testing in pipeline
- [ ] Set up GitOps with ArgoCD
- [ ] Implement auto-scaling (HPA)
- [ ] Add SSL/TLS with cert-manager

## 🤝 Contributing

This is a portfolio project, but feedback and suggestions are welcome!

## 📄 License

This project is open source and available for learning purposes.

## 👤 Author

**Your Name**
- Portfolio: [Your Portfolio URL]
- LinkedIn: [Your LinkedIn]
- GitHub: [Your GitHub]

## 🙏 Acknowledgments

- AWS Free Tier program
- Kubernetes community
- Jenkins community
- Docker community

---

## Quick Command Reference

```bash
# Start infrastructure
./scripts/manage-instances.sh start

# Stop infrastructure (save costs)
./scripts/manage-instances.sh stop

# Check status
./scripts/manage-instances.sh status

# Monitor costs
./scripts/check-costs.sh

# Clean up ECR
./scripts/cleanup-ecr.sh

# View Jenkins logs
ssh -i hr-ai-key.pem ubuntu@<JENKINS_IP>
sudo journalctl -u jenkins -f

# View Kubernetes pods
kubectl get pods -n hr-ai

# View application logs
kubectl logs -f <pod-name> -n hr-ai

# Scale deployment
kubectl scale deployment hr-ai-deployment --replicas=3 -n hr-ai

# Rollback deployment
kubectl rollout undo deployment/hr-ai-deployment -n hr-ai
```

---

**Total Setup Time**: ~2-3 hours

**Monthly Cost**: $10-15 (within $100 credit for 6+ months)

**Status**: ✅ Production-Ready for Portfolio/Demo

For detailed setup instructions, please refer to the documentation in the `docs/` directory.

