# Quick Start Guide

This guide will get your CI/CD pipeline up and running in ~2 hours.

## Prerequisites Checklist

- [ ] AWS Account with $100 credit
- [ ] AWS CLI installed (`aws --version`)
- [ ] Git installed
- [ ] SSH client installed
- [ ] Text editor for configuration files

## Setup Flow

```
1. AWS Infrastructure (45 min)
   ↓
2. Kubernetes Cluster (45 min)
   ↓
3. Jenkins Server (30 min)
   ↓
4. Deploy Application (15 min)
   ↓
5. Test & Verify (15 min)
```

## Step-by-Step Instructions

### Phase 1: AWS Infrastructure Setup (45 minutes)

1. **Configure AWS CLI**
   ```bash
   aws configure
   # Enter your AWS Access Key, Secret Key, and region (us-east-1)
   ```

2. **Clone this repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/HR-AI.git
   cd HR-AI
   ```

3. **Run AWS setup commands**
   ```bash
   # Follow all commands in docs/AWS_SETUP.md
   # This will create:
   # - VPC and networking
   # - 3 EC2 instances
   # - Security groups
   # - ECR repository
   # - IAM roles
   
   # Save the output configuration file!
   ```

4. **Verify infrastructure**
   ```bash
   # Check instances are running
   aws ec2 describe-instances --filters "Name=tag:Project,Values=hr-ai" --query 'Reservations[*].Instances[*].[Tags[?Key==`Name`].Value|[0],State.Name,PublicIpAddress]' --output table
   ```

### Phase 2: Kubernetes Cluster Setup (45 minutes)

1. **Copy setup scripts to master node**
   ```bash
   # Get IPs from aws-infrastructure-config.txt
   source aws-infrastructure-config.txt
   
   # Copy script
   scp -i hr-ai-key.pem scripts/setup-k8s-master.sh ubuntu@$K8S_MASTER_PUBLIC_IP:~/
   ```

2. **Run master setup**
   ```bash
   # SSH into master
   ssh -i hr-ai-key.pem ubuntu@$K8S_MASTER_PUBLIC_IP
   
   # Run setup
   chmod +x setup-k8s-master.sh
   ./setup-k8s-master.sh
   
   # Wait for completion (5-10 minutes)
   # Save the join command from output!
   ```

3. **Set up worker node**
   ```bash
   # In a new terminal, copy script to worker
   scp -i hr-ai-key.pem scripts/setup-k8s-worker.sh ubuntu@$K8S_WORKER_PUBLIC_IP:~/
   
   # SSH into worker
   ssh -i hr-ai-key.pem ubuntu@$K8S_WORKER_PUBLIC_IP
   
   # Run setup
   chmod +x setup-k8s-worker.sh
   ./setup-k8s-worker.sh
   
   # After completion, run the join command from master:
   sudo kubeadm join <master-ip>:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>
   ```

4. **Verify cluster**
   ```bash
   # On master node
   kubectl get nodes
   # Both nodes should show "Ready"
   
   kubectl get pods -A
   # All system pods should be "Running"
   ```

### Phase 3: Jenkins Setup (30 minutes)

1. **Copy setup script**
   ```bash
   # From local machine
   scp -i hr-ai-key.pem scripts/setup-jenkins.sh ubuntu@$JENKINS_PUBLIC_IP:~/
   ```

2. **Run Jenkins setup**
   ```bash
   # SSH into Jenkins
   ssh -i hr-ai-key.pem ubuntu@$JENKINS_PUBLIC_IP
   
   # Run setup
   chmod +x setup-jenkins.sh
   ./setup-jenkins.sh
   
   # Save the initial admin password!
   ```

3. **Configure Jenkins (Web UI)**
   ```
   1. Open: http://<JENKINS_PUBLIC_IP>:8080
   2. Enter initial admin password
   3. Install suggested plugins
   4. Install additional plugins:
      - Docker Pipeline
      - Kubernetes CLI
      - Amazon ECR
   5. Create admin user
   6. Save configuration
   ```

4. **Copy kubeconfig to Jenkins**
   ```bash
   # On master node
   cat ~/.kube/config
   
   # Copy the output
   
   # On Jenkins server
   sudo mkdir -p /var/lib/jenkins/.kube
   sudo nano /var/lib/jenkins/.kube/config
   # Paste kubeconfig
   # Change server URL to master's PUBLIC IP
   
   sudo chown jenkins:jenkins /var/lib/jenkins/.kube/config
   sudo chmod 600 /var/lib/jenkins/.kube/config
   
   # Test
   sudo -u jenkins kubectl get nodes
   ```

5. **Create Jenkins pipeline job**
   ```
   1. Click "New Item"
   2. Name: hr-ai-pipeline
   3. Type: Pipeline
   4. Pipeline from SCM: Git
   5. Repository URL: https://github.com/YOUR_USERNAME/HR-AI.git
   6. Script Path: Jenkinsfile
   7. Save
   ```

### Phase 4: Deploy Application (15 minutes)

1. **Create namespace**
   ```bash
   # On Kubernetes master
   kubectl apply -f k8s/namespace.yaml
   kubectl get namespaces
   ```

2. **Trigger Jenkins build**
   ```
   1. Go to Jenkins UI
   2. Click on "hr-ai-pipeline"
   3. Click "Build Now"
   4. Monitor build in console output
   ```

3. **Wait for deployment**
   ```bash
   # On Kubernetes master
   kubectl get pods -n hr-ai -w
   # Wait for pods to be "Running"
   ```

### Phase 5: Test & Verify (15 minutes)

1. **Get application URL**
   ```bash
   # On Kubernetes master
   kubectl get service hr-ai-service -n hr-ai
   
   # Note the NodePort (e.g., 30080)
   # Access at: http://<ANY_K8S_NODE_IP>:<NODE_PORT>
   ```

2. **Test application**
   ```bash
   # From your local machine
   curl http://<K8S_WORKER_PUBLIC_IP>:30080
   
   # Or open in browser:
   http://<K8S_WORKER_PUBLIC_IP>:30080
   ```

3. **Verify CI/CD pipeline**
   ```bash
   # Make a change to index.html
   # Commit and push to GitHub
   # Jenkins will automatically build and deploy
   # Verify new version is deployed
   ```

## Verification Checklist

- [ ] All 3 EC2 instances are running
- [ ] Kubernetes cluster has 2 nodes in "Ready" state
- [ ] Jenkins is accessible at http://<JENKINS_IP>:8080
- [ ] ECR repository exists and is accessible
- [ ] Jenkins can connect to Kubernetes cluster
- [ ] Application namespace exists
- [ ] Application pods are running
- [ ] Application is accessible via NodePort
- [ ] CI/CD pipeline builds successfully
- [ ] Deployments update automatically on code push

## Common Issues & Solutions

### Issue: SSH connection timeout
**Solution**: Check security groups allow SSH (port 22) from your IP

### Issue: Kubernetes nodes not joining
**Solution**: 
```bash
# Verify security group allows port 6443
# Check token hasn't expired (valid for 24 hours)
# Generate new token on master:
sudo kubeadm token create --print-join-command
```

### Issue: Jenkins can't pull from ECR
**Solution**:
```bash
# Verify IAM role is attached to Jenkins instance
aws ec2 describe-instances --instance-ids <JENKINS_INSTANCE_ID> --query 'Reservations[0].Instances[0].IamInstanceProfile'

# Test ECR access
sudo -u jenkins aws ecr describe-repositories
```

### Issue: Pods in "ImagePullBackOff"
**Solution**:
```bash
# Check if image exists in ECR
aws ecr list-images --repository-name hr-ai

# Verify nodes can pull from ECR
# On each K8s node:
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ECR_REPO>
```

### Issue: Application not accessible
**Solution**:
```bash
# Check service
kubectl get service hr-ai-service -n hr-ai

# Check pods
kubectl get pods -n hr-ai

# Check pod logs
kubectl logs <pod-name> -n hr-ai

# Verify security group allows NodePort (30000-32767)
```

## Cost Optimization Tips

1. **Stop instances when not in use**
   ```bash
   ./scripts/manage-instances.sh stop
   # Saves ~$7/month in EC2 costs
   ```

2. **Set up billing alerts**
   ```bash
   # Follow steps in docs/COST_OPTIMIZATION.md
   # Get notified at $50 and $80
   ```

3. **Clean up regularly**
   ```bash
   # Weekly cleanup
   ./scripts/cleanup-ecr.sh
   ./scripts/check-costs.sh
   ```

## Next Steps

After basic setup is complete:

1. **Configure GitHub webhook** for automatic builds
2. **Set up monitoring** (optional)
3. **Implement SSL/TLS** (optional)
4. **Add automated tests** to pipeline
5. **Review security settings**

## Getting Help

If you encounter issues:

1. Check the detailed documentation:
   - `docs/AWS_SETUP.md`
   - `docs/K8S_SETUP.md`
   - `docs/JENKINS_SETUP.md`

2. Review logs:
   ```bash
   # Jenkins logs
   sudo journalctl -u jenkins -f
   
   # Kubernetes logs
   kubectl logs <pod-name> -n hr-ai
   
   # System logs
   sudo journalctl -xe
   ```

3. Verify each component:
   ```bash
   # AWS resources
   ./scripts/check-costs.sh
   
   # Kubernetes
   kubectl get all -n hr-ai
   
   # Jenkins
   systemctl status jenkins
   ```

## Success Criteria

Your setup is successful when:
- ✅ You can access Jenkins UI
- ✅ You can trigger a build in Jenkins
- ✅ Build completes successfully
- ✅ Image is pushed to ECR
- ✅ Deployment appears in Kubernetes
- ✅ Pods are running and healthy
- ✅ Application is accessible via browser
- ✅ Code changes trigger automatic deployment

## Estimated Costs

- **Setup phase**: $0 (using free tier)
- **Running 24/7**: $10-15/month
- **Work hours only**: $5-7/month
- **Occasional use**: $3-5/month

Your $100 credit will last **6-10 months** with this setup!

---

**Need help?** Refer to the detailed documentation in the `docs/` directory.

**Ready to deploy?** Follow the steps above and you'll have a production-ready CI/CD pipeline in ~2 hours!

