# Kubernetes Cluster Setup Guide

This guide provides step-by-step instructions for setting up a Kubernetes cluster on AWS EC2 instances using kubeadm.

## Prerequisites

- AWS infrastructure set up (see `docs/AWS_SETUP.md`)
- 3 EC2 instances running Ubuntu 22.04 LTS:
  - 1 Master node (t2.micro)
  - 1 Worker node (t2.micro)
  - Security groups configured properly
- SSH access to all instances
- Key pair file (`hr-ai-key.pem`)

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Kubernetes Cluster                  │
│                                                  │
│  ┌──────────────────┐      ┌─────────────────┐ │
│  │   Master Node    │      │   Worker Node   │ │
│  │                  │      │                 │ │
│  │  - API Server    │◄────►│  - Kubelet      │ │
│  │  - Scheduler     │      │  - Kube-proxy   │ │
│  │  - Controller    │      │  - Containerd   │ │
│  │  - etcd          │      │  - Pods         │ │
│  │  - Containerd    │      │                 │ │
│  └──────────────────┘      └─────────────────┘ │
│           │                                      │
│           ▼                                      │
│   ┌──────────────┐                              │
│   │  Flannel CNI  │                             │
│   └──────────────┘                              │
└─────────────────────────────────────────────────┘
```

## Quick Setup (Automated)

### Step 1: Copy Setup Scripts to Instances

From your local machine:

```bash
# Get instance IPs from aws-infrastructure-config.txt
source aws-infrastructure-config.txt

# Copy master setup script
scp -i hr-ai-key.pem scripts/setup-k8s-master.sh ubuntu@$K8S_MASTER_PUBLIC_IP:~/

# Copy worker setup script
scp -i hr-ai-key.pem scripts/setup-k8s-worker.sh ubuntu@$K8S_WORKER_PUBLIC_IP:~/
```

### Step 2: Set Up Master Node

```bash
# SSH into master node
ssh -i hr-ai-key.pem ubuntu@$K8S_MASTER_PUBLIC_IP

# Make script executable and run
chmod +x setup-k8s-master.sh
./setup-k8s-master.sh

# Wait for setup to complete (5-10 minutes)
# The script will output cluster information and worker join command
```

### Step 3: Set Up Worker Node

```bash
# In a new terminal, SSH into worker node
ssh -i hr-ai-key.pem ubuntu@$K8S_WORKER_PUBLIC_IP

# Make script executable and run
chmod +x setup-k8s-worker.sh
./setup-k8s-worker.sh

# After setup completes, copy the join command from master node
# On master: cat ~/worker-join-command.sh

# On worker, run the join command (example):
sudo kubeadm join 10.0.1.10:6443 --token abcdef.0123456789abcdef \
    --discovery-token-ca-cert-hash sha256:1234567890abcdef...
```

### Step 4: Verify Cluster

On the master node:

```bash
# Check nodes status
kubectl get nodes

# Expected output:
# NAME             STATUS   ROLES           AGE   VERSION
# ip-10-0-1-10     Ready    control-plane   5m    v1.28.x
# ip-10-0-1-11     Ready    <none>          2m    v1.28.x

# Check all pods
kubectl get pods -A

# Check cluster info
kubectl cluster-info
```

## Manual Setup (Step-by-Step)

If you prefer to understand each step or troubleshoot, follow these manual instructions.

### Master Node Setup

#### 1. Connect to Master Node

```bash
ssh -i hr-ai-key.pem ubuntu@<MASTER_PUBLIC_IP>
```

#### 2. Update System

```bash
sudo apt-get update && sudo apt-get upgrade -y
```

#### 3. Disable Swap

```bash
sudo swapoff -a
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab
```

#### 4. Load Kernel Modules

```bash
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter
```

#### 5. Configure Sysctl

```bash
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

sudo sysctl --system
```

#### 6. Install Containerd

```bash
# Install dependencies
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install containerd
sudo apt-get update
sudo apt-get install -y containerd.io

# Configure containerd
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml

# Enable systemd cgroup driver
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml

# Restart containerd
sudo systemctl restart containerd
sudo systemctl enable containerd
```

#### 7. Install Kubernetes Components

```bash
# Install dependencies
sudo apt-get install -y apt-transport-https

# Add Kubernetes GPG key
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.28/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

# Add Kubernetes repository
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.28/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list

# Install kubelet, kubeadm, kubectl
sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl
```

#### 8. Initialize Kubernetes Cluster

```bash
# Get master node private IP
MASTER_IP=$(hostname -I | awk '{print $1}')

# Initialize cluster
sudo kubeadm init \
  --pod-network-cidr=10.244.0.0/16 \
  --apiserver-advertise-address=$MASTER_IP \
  --apiserver-cert-extra-sans=$MASTER_IP

# Set up kubeconfig
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

#### 9. Install CNI Plugin (Flannel)

```bash
kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml

# Wait for flannel to be ready
kubectl wait --for=condition=Ready pods --all -n kube-flannel --timeout=300s
```

#### 10. Generate Worker Join Command

```bash
sudo kubeadm token create --print-join-command > ~/worker-join-command.sh
chmod +x ~/worker-join-command.sh
cat ~/worker-join-command.sh
```

### Worker Node Setup

#### 1. Connect to Worker Node

```bash
ssh -i hr-ai-key.pem ubuntu@<WORKER_PUBLIC_IP>
```

#### 2. Repeat Steps 2-7 from Master Node Setup

Follow the same steps for system update, swap disable, kernel modules, containerd, and Kubernetes component installation.

#### 3. Join the Cluster

```bash
# Copy the join command from master node and run it with sudo
sudo kubeadm join <master-ip>:6443 --token <token> \
    --discovery-token-ca-cert-hash sha256:<hash>
```

#### 4. Verify on Master

```bash
# On master node, check if worker joined
kubectl get nodes
```

## Post-Installation Configuration

### Configure kubectl Access from Jenkins

On the master node:

```bash
# Copy kubeconfig
cp ~/.kube/config ~/kubeconfig-jenkins.yaml

# Get the master node's public IP
MASTER_PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

# Update the server address in kubeconfig
sed -i "s|server: https://.*:6443|server: https://$MASTER_PUBLIC_IP:6443|g" ~/kubeconfig-jenkins.yaml

# Display the kubeconfig
cat ~/kubeconfig-jenkins.yaml
```

Copy this kubeconfig to your Jenkins server:

```bash
# From your local machine
scp -i hr-ai-key.pem ubuntu@<MASTER_PUBLIC_IP>:~/kubeconfig-jenkins.yaml .
scp -i hr-ai-key.pem kubeconfig-jenkins.yaml ubuntu@<JENKINS_PUBLIC_IP>:~/.kube/config
```

### Create Namespace for Application

On the master node:

```bash
# Apply namespace manifest
kubectl apply -f k8s/namespace.yaml

# Verify
kubectl get namespaces
```

### Configure ECR Access

On all nodes (master and workers):

```bash
# Install AWS CLI
sudo apt-get install -y unzip
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
rm -rf aws awscliv2.zip

# Install ECR credential helper
wget https://amazon-ecr-credential-helper-releases.s3.us-east-2.amazonaws.com/0.7.1/linux-amd64/docker-credential-ecr-login
chmod +x docker-credential-ecr-login
sudo mv docker-credential-ecr-login /usr/local/bin/

# Test AWS credentials (should work with IAM role)
aws sts get-caller-identity
```

### Create ImagePullSecret for ECR

```bash
# Get ECR login token
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Get password
ECR_PASSWORD=$(aws ecr get-login-password --region $AWS_REGION)

# Create secret in hr-ai namespace
kubectl create secret docker-registry ecr-secret \
  --docker-server=$ECR_REPO \
  --docker-username=AWS \
  --docker-password=$ECR_PASSWORD \
  --namespace=hr-ai

# Verify secret
kubectl get secrets -n hr-ai
```

**Note:** ECR tokens expire after 12 hours. You can:
1. Automate token refresh using a CronJob
2. Use IAM roles (already configured on EC2 instances)
3. Use ECR credential helper (already installed)

## Testing the Cluster

### Deploy a Test Application

```bash
# Create a test deployment
kubectl create deployment nginx --image=nginx --replicas=2 -n hr-ai

# Expose the deployment
kubectl expose deployment nginx --port=80 --type=NodePort -n hr-ai

# Check status
kubectl get pods -n hr-ai
kubectl get svc -n hr-ai

# Get NodePort
NODE_PORT=$(kubectl get svc nginx -n hr-ai -o jsonpath='{.spec.ports[0].nodePort}')
echo "Access nginx at: http://<WORKER_PUBLIC_IP>:$NODE_PORT"

# Cleanup test deployment
kubectl delete deployment nginx -n hr-ai
kubectl delete service nginx -n hr-ai
```

## Troubleshooting

### Node Not Ready

```bash
# Check node status details
kubectl describe node <node-name>

# Check kubelet logs
sudo journalctl -u kubelet -f

# Restart kubelet
sudo systemctl restart kubelet
```

### Pods Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n hr-ai

# Check pod logs
kubectl logs <pod-name> -n hr-ai

# Check events
kubectl get events -n hr-ai --sort-by='.lastTimestamp'
```

### CNI Issues

```bash
# Check flannel pods
kubectl get pods -n kube-flannel

# Check flannel logs
kubectl logs -n kube-flannel <flannel-pod-name>

# Reinstall flannel if needed
kubectl delete -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml
kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml
```

### Containerd Issues

```bash
# Check containerd status
sudo systemctl status containerd

# Check containerd logs
sudo journalctl -u containerd -f

# Restart containerd
sudo systemctl restart containerd
```

### ECR Access Issues

```bash
# Test AWS credentials
aws sts get-caller-identity

# Test ECR login
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ECR_REPO>

# Check IAM role attached to instance
aws sts get-caller-identity
```

### Kubeadm Join Fails

```bash
# On worker node, reset kubeadm
sudo kubeadm reset

# Clean up
sudo rm -rf /etc/cni/net.d
sudo rm -rf $HOME/.kube

# Try joining again with the new token
# On master, generate new token if old one expired
sudo kubeadm token create --print-join-command
```

## Useful Commands

```bash
# Check cluster status
kubectl cluster-info
kubectl get nodes
kubectl get pods -A

# Check resource usage
kubectl top nodes
kubectl top pods -n hr-ai

# Check logs
kubectl logs <pod-name> -n hr-ai
kubectl logs <pod-name> -n hr-ai --previous  # Previous container logs

# Execute command in pod
kubectl exec -it <pod-name> -n hr-ai -- /bin/sh

# Port forward for debugging
kubectl port-forward <pod-name> 8080:8080 -n hr-ai

# Scale deployment
kubectl scale deployment hr-ai-deployment --replicas=3 -n hr-ai

# Update deployment image
kubectl set image deployment/hr-ai-deployment hr-ai-container=<new-image> -n hr-ai

# Rollback deployment
kubectl rollout undo deployment/hr-ai-deployment -n hr-ai

# Check rollout status
kubectl rollout status deployment/hr-ai-deployment -n hr-ai
```

## Security Best Practices

1. **Network Policies**: Consider implementing network policies to restrict pod-to-pod communication
2. **RBAC**: Configure Role-Based Access Control for different users/services
3. **Secrets Management**: Never commit secrets to Git; use Kubernetes secrets or external secret managers
4. **Image Scanning**: Scan Docker images for vulnerabilities before deployment
5. **Update Regularly**: Keep Kubernetes components and the OS updated

## Performance Optimization for t2.micro

Since we're using t2.micro instances (1 vCPU, 1GB RAM), consider:

1. **Resource Limits**: Set appropriate resource requests and limits
2. **Pod Disruption Budgets**: Ensure high availability during updates
3. **Horizontal Pod Autoscaling**: Scale based on metrics (if needed)
4. **Monitoring**: Use lightweight monitoring solutions

## Cost Optimization

1. **Stop instances** when not in use (non-production)
2. **Clean up old images** from ECR regularly
3. **Monitor data transfer** costs
4. **Use spot instances** for non-critical workloads (advanced)

## Next Steps

1. ✅ Kubernetes cluster is ready
2. Proceed to `docs/JENKINS_SETUP.md` to set up Jenkins
3. Configure CI/CD pipeline with the updated Jenkinsfile
4. Deploy your application to the cluster

## Summary

After completing this guide, you should have:
- ✅ Kubernetes cluster with 1 master and 1 worker node
- ✅ Flannel CNI for pod networking
- ✅ kubectl configured on master node
- ✅ ECR access configured on all nodes
- ✅ Namespace created for the application
- ✅ Cluster ready for application deployment

**Cluster Setup Time:** 30-45 minutes

