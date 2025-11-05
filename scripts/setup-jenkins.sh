#!/bin/bash
# Jenkins Setup Script
# Run this script on the EC2 instance designated as the Jenkins server

set -e

echo "================================================="
echo "Jenkins Server Setup"
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

# Get instance IP
JENKINS_IP=$(hostname -I | awk '{print $1}')
JENKINS_PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
print_message "Jenkins server IP (private): $JENKINS_IP"
print_message "Jenkins server IP (public): $JENKINS_PUBLIC_IP"

# Update system packages
print_message "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Java (OpenJDK 17 for Jenkins)
print_message "Installing Java..."
sudo apt-get install -y fontconfig openjdk-17-jre
java -version

# Add Jenkins repository
print_message "Adding Jenkins repository..."
sudo wget -O /usr/share/keyrings/jenkins-keyring.asc \
  https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key

echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/ | sudo tee \
  /etc/apt/sources.list.d/jenkins.list > /dev/null

# Install Jenkins
print_message "Installing Jenkins..."
sudo apt-get update
sudo apt-get install -y jenkins

# Start Jenkins service
print_message "Starting Jenkins service..."
sudo systemctl start jenkins
sudo systemctl enable jenkins

# Wait for Jenkins to start
print_message "Waiting for Jenkins to start (this may take a minute)..."
sleep 30

# Install Docker
print_message "Installing Docker..."
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add Jenkins user to docker group
print_message "Adding Jenkins user to docker group..."
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins

# Install AWS CLI
print_message "Installing AWS CLI..."
sudo apt-get install -y unzip
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
rm -rf aws awscliv2.zip

# Configure AWS CLI for Jenkins user
print_message "Configuring AWS CLI..."
sudo -u jenkins aws configure set region us-east-1
sudo -u jenkins aws sts get-caller-identity

# Install kubectl
print_message "Installing kubectl..."
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
rm kubectl

# Create .kube directory for Jenkins user
print_message "Setting up kubectl for Jenkins user..."
sudo mkdir -p /var/lib/jenkins/.kube
sudo chown jenkins:jenkins /var/lib/jenkins/.kube

# Install Git
print_message "Installing Git..."
sudo apt-get install -y git

# Get initial admin password
print_message "Retrieving Jenkins initial admin password..."
JENKINS_PASSWORD=$(sudo cat /var/jenkins_home/secrets/initialAdminPassword 2>/dev/null || sudo cat /var/lib/jenkins/secrets/initialAdminPassword 2>/dev/null)

# Save configuration
cat > $HOME/jenkins-info.txt <<EOF
================================================
Jenkins Server Information
================================================

Jenkins URL: http://$JENKINS_PUBLIC_IP:8080

Initial Admin Password: $JENKINS_PASSWORD

Server Details:
- Private IP: $JENKINS_IP
- Public IP: $JENKINS_PUBLIC_IP
- Jenkins Home: /var/lib/jenkins
- Java Version: $(java -version 2>&1 | head -n 1)
- Docker Version: $(docker --version)
- AWS CLI Version: $(aws --version)
- kubectl Version: $(kubectl version --client --short 2>/dev/null || echo "Not configured yet")

User Information:
- Jenkins runs as user: jenkins
- Jenkins is member of groups: $(sudo -u jenkins groups)

Required Plugins (install via Jenkins UI):
1. Docker Pipeline
2. Kubernetes CLI
3. Amazon ECR
4. Git
5. Pipeline
6. Pipeline: Stage View
7. Credentials Binding
8. Workspace Cleanup

Next Steps:
1. Access Jenkins at: http://$JENKINS_PUBLIC_IP:8080
2. Use the initial admin password above to unlock Jenkins
3. Install suggested plugins + required plugins listed above
4. Create an admin user
5. Configure Jenkins system settings
6. Add kubeconfig to Jenkins credentials
7. Add AWS credentials (optional, using IAM role)
8. Create a new pipeline job for hr-ai project

================================================
Kubeconfig Setup:
================================================

After Kubernetes cluster is ready, copy kubeconfig from master:

1. On K8s master:
   cat ~/.kube/config

2. On Jenkins server:
   sudo nano /var/lib/jenkins/.kube/config
   # Paste the kubeconfig content
   # Update server URL to use master's public IP
   
   sudo chown jenkins:jenkins /var/lib/jenkins/.kube/config
   sudo chmod 600 /var/lib/jenkins/.kube/config

3. Test kubectl access:
   sudo -u jenkins kubectl get nodes

================================================
EOF

cat $HOME/jenkins-info.txt

print_message "================================================="
print_message "Jenkins Setup Complete!"
print_message "================================================="
print_message ""
print_message "Jenkins is now running at: http://$JENKINS_PUBLIC_IP:8080"
print_message ""
print_message "Initial Admin Password: $JENKINS_PASSWORD"
print_message ""
print_message "IMPORTANT: Save the jenkins-info.txt file for reference"
print_message "Location: $HOME/jenkins-info.txt"
print_message ""
print_warning "Next Steps:"
print_warning "1. Open http://$JENKINS_PUBLIC_IP:8080 in your browser"
print_warning "2. Use the password above to unlock Jenkins"
print_warning "3. Install required plugins"
print_warning "4. Configure Jenkins credentials and system settings"
print_warning "5. Copy kubeconfig from Kubernetes master"
print_warning ""
print_message "For detailed configuration steps, see: docs/JENKINS_SETUP.md"

