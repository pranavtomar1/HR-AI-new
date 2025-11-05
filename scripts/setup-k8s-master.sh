#!/bin/bash
# Kubernetes Master Node Setup Script
# Run this script on the EC2 instance designated as the Kubernetes master node

set -e

echo "================================================="
echo "Kubernetes Master Node Setup"
echo "================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Get instance private IP
MASTER_IP=$(hostname -I | awk '{print $1}')
print_message "Master node IP: $MASTER_IP"

# Update system packages
print_message "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Disable swap (required for Kubernetes)
print_message "Disabling swap..."
sudo swapoff -a
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab

# Load kernel modules
print_message "Loading kernel modules..."
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter

# Set sysctl parameters
print_message "Configuring sysctl parameters..."
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

sudo sysctl --system

# Install containerd
print_message "Installing containerd..."
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y containerd.io

# Configure containerd
print_message "Configuring containerd..."
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml > /dev/null

# Enable systemd cgroup driver
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml

# Restart containerd
sudo systemctl restart containerd
sudo systemctl enable containerd

# Install Kubernetes components
print_message "Installing Kubernetes components..."
sudo apt-get install -y apt-transport-https

# Add Kubernetes GPG key
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.28/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

# Add Kubernetes repository
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.28/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list

sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl

# Initialize Kubernetes cluster
print_message "Initializing Kubernetes cluster..."
print_warning "This may take a few minutes..."

sudo kubeadm init \
  --pod-network-cidr=10.244.0.0/16 \
  --apiserver-advertise-address=$MASTER_IP \
  --apiserver-cert-extra-sans=$MASTER_IP \
  | tee kubeadm-init.log

# Set up kubeconfig for ubuntu user
print_message "Setting up kubeconfig..."
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# Also create a backup
cp $HOME/.kube/config $HOME/kubeconfig-backup.yaml

# Install Flannel CNI
print_message "Installing Flannel CNI plugin..."
kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml

# Wait for Flannel to be ready
print_message "Waiting for Flannel to be ready..."
sleep 30

# Generate join command for worker nodes
print_message "Generating worker node join command..."
sudo kubeadm token create --print-join-command > $HOME/worker-join-command.sh
chmod +x $HOME/worker-join-command.sh

# Install kubectl autocompletion
print_message "Setting up kubectl autocompletion..."
echo 'source <(kubectl completion bash)' >> $HOME/.bashrc
echo 'alias k=kubectl' >> $HOME/.bashrc
echo 'complete -F __start_kubectl k' >> $HOME/.bashrc

# Install AWS CLI (for ECR access)
print_message "Installing AWS CLI..."
sudo apt-get install -y unzip
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
rm -rf aws awscliv2.zip

# Configure ECR credential helper for containerd
print_message "Configuring ECR credential helper..."
wget https://amazon-ecr-credential-helper-releases.s3.us-east-2.amazonaws.com/0.7.1/linux-amd64/docker-credential-ecr-login
chmod +x docker-credential-ecr-login
sudo mv docker-credential-ecr-login /usr/local/bin/

# Wait for all system pods to be ready
print_message "Waiting for all system pods to be ready..."
kubectl wait --for=condition=Ready pods --all -n kube-system --timeout=300s

# Display cluster status
print_message "Cluster status:"
kubectl get nodes
kubectl get pods -A

# Save important information
cat > $HOME/cluster-info.txt <<EOF
================================================
Kubernetes Cluster Information
================================================

Master Node IP: $MASTER_IP
Kubernetes Version: $(kubectl version --short 2>/dev/null | grep Server || kubectl version --output=json | grep -o '"gitVersion":"[^"]*"' | cut -d'"' -f4)

Cluster Status:
$(kubectl get nodes)

Important Files:
- kubeconfig: $HOME/.kube/config
- kubeconfig backup: $HOME/kubeconfig-backup.yaml
- worker join command: $HOME/worker-join-command.sh
- initialization log: $HOME/kubeadm-init.log

Next Steps:
1. Copy the kubeconfig to your Jenkins server
2. Run the worker join command on worker nodes
3. Verify all nodes are ready: kubectl get nodes

Worker Join Command:
$(cat $HOME/worker-join-command.sh)

================================================
EOF

cat $HOME/cluster-info.txt

print_message "================================================="
print_message "Kubernetes Master Node Setup Complete!"
print_message "================================================="
print_message ""
print_message "IMPORTANT: Save the following files:"
print_message "  - $HOME/.kube/config (for kubectl access)"
print_message "  - $HOME/worker-join-command.sh (to join worker nodes)"
print_message "  - $HOME/cluster-info.txt (cluster information)"
print_message ""
print_message "To join worker nodes, copy and run worker-join-command.sh on each worker"
print_message ""
print_message "To access the cluster from another machine:"
print_message "  1. Copy $HOME/.kube/config to ~/.kube/config on your machine"
print_message "  2. Update the server address if needed"
print_message "  3. Run: kubectl get nodes"

