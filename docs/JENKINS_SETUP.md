# Jenkins Setup and Configuration Guide

This guide provides step-by-step instructions for setting up Jenkins on AWS EC2 and configuring it for CI/CD with Kubernetes and ECR.

## Prerequisites

- Jenkins EC2 instance running Ubuntu 22.04 LTS (from AWS setup)
- SSH access to the Jenkins instance
- Kubernetes cluster already set up
- ECR repository created
- Key pair file (`hr-ai-key.pem`)

## Quick Setup (Automated)

### Step 1: Copy and Run Setup Script

```bash
# From your local machine
# Get Jenkins instance IP from aws-infrastructure-config.txt
source aws-infrastructure-config.txt

# Copy setup script
scp -i hr-ai-key.pem scripts/setup-jenkins.sh ubuntu@$JENKINS_PUBLIC_IP:~/

# SSH into Jenkins instance
ssh -i hr-ai-key.pem ubuntu@$JENKINS_PUBLIC_IP

# Run setup script
chmod +x setup-jenkins.sh
./setup-jenkins.sh

# Wait for setup to complete (5-10 minutes)
# Note the initial admin password displayed at the end
```

### Step 2: Access Jenkins Web Interface

1. Open your browser and navigate to: `http://<JENKINS_PUBLIC_IP>:8080`
2. You'll see "Unlock Jenkins" page
3. Enter the initial admin password (from setup script output or `jenkins-info.txt`)
4. Click "Continue"

### Step 3: Install Plugins

1. Select "Install suggested plugins"
2. Wait for plugins to install
3. After suggested plugins are installed, go to "Manage Jenkins" → "Manage Plugins"
4. Install additional required plugins:
   - Docker Pipeline
   - Kubernetes CLI
   - Amazon ECR
   - Pipeline: AWS Steps
   - Credentials Binding
   - Workspace Cleanup

### Step 4: Create Admin User

1. Fill in the admin user details:
   - Username: `admin` (or your preferred username)
   - Password: Choose a strong password
   - Full name: Your name
   - Email: Your email
2. Click "Save and Continue"
3. Click "Save and Finish"
4. Click "Start using Jenkins"

## Manual Jenkins Configuration

### Configure Global Tools

1. Go to **Manage Jenkins** → **Global Tool Configuration**

#### Java Configuration
- Should be auto-detected (OpenJDK 17)
- Name: `Java-17`
- JAVA_HOME: `/usr/lib/jvm/java-17-openjdk-amd64`

#### Docker Configuration
- Add Docker installation
- Name: `docker`
- Install automatically: Yes

#### Git Configuration
- Should be auto-detected
- Name: `Default`
- Path to Git executable: `git`

### Configure Credentials

Go to **Manage Jenkins** → **Manage Credentials** → **System** → **Global credentials**

#### 1. Add Kubeconfig (for Kubernetes deployment)

```bash
# On Jenkins server, first copy kubeconfig from K8s master
ssh -i hr-ai-key.pem ubuntu@<K8S_MASTER_PUBLIC_IP> "cat ~/.kube/config" > kubeconfig-temp.yaml

# Edit the kubeconfig to use master's public IP instead of private IP
# Update the server line:
# server: https://<K8S_MASTER_PUBLIC_IP>:6443

# Copy to Jenkins
sudo mkdir -p /var/lib/jenkins/.kube
sudo cp kubeconfig-temp.yaml /var/lib/jenkins/.kube/config
sudo chown jenkins:jenkins /var/lib/jenkins/.kube/config
sudo chmod 600 /var/lib/jenkins/.kube/config

# Test access
sudo -u jenkins kubectl get nodes
```

In Jenkins UI:
- Click "Add Credentials"
- Kind: **Secret file**
- Scope: Global
- File: Upload `/var/lib/jenkins/.kube/config`
- ID: `kubeconfig`
- Description: `Kubernetes Config File`
- Click "OK"

#### 2. Add AWS Credentials (Optional, IAM role already configured)

If you want explicit AWS credentials:
- Kind: **AWS Credentials**
- Scope: Global
- Access Key ID: `<YOUR_AWS_ACCESS_KEY>`
- Secret Access Key: `<YOUR_AWS_SECRET_KEY>`
- ID: `aws-credentials`
- Description: `AWS Credentials for ECR`

**Note:** Since we're using IAM roles attached to the EC2 instance, this is optional. Jenkins can access ECR directly through the instance role.

#### 3. Add GitHub Credentials (for private repos)

If your repository is private:
- Kind: **Username with password** or **SSH Username with private key**
- Scope: Global
- Username: Your GitHub username
- Password/Private Key: Your GitHub token or SSH key
- ID: `github-credentials`
- Description: `GitHub Credentials`

### Configure System Settings

Go to **Manage Jenkins** → **Configure System**

#### Environment Variables

Add the following environment variables:
- Name: `AWS_REGION`, Value: `us-east-1`
- Name: `AWS_ACCOUNT_ID`, Value: `<YOUR_AWS_ACCOUNT_ID>`
- Name: `ECR_REPO`, Value: `<AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/hr-ai`

#### Docker Configuration

Scroll to "Docker" section:
- Check "Enable Docker"
- Docker Host URI: `unix:///var/run/docker.sock` (default)

## Create Jenkins Pipeline Job

### Step 1: Create New Job

1. From Jenkins dashboard, click "New Item"
2. Enter item name: `hr-ai-pipeline`
3. Select "Pipeline"
4. Click "OK"

### Step 2: Configure Job

#### General Settings
- Description: `CI/CD pipeline for HR-AI application deployment to Kubernetes`
- Check "Discard old builds"
  - Strategy: Log Rotation
  - Max # of builds to keep: `10`

#### Build Triggers
- Check "Poll SCM" (for testing)
  - Schedule: `H/5 * * * *` (poll every 5 minutes)
- Or check "GitHub hook trigger for GITScm polling" (for production)

#### Pipeline Configuration
- Definition: **Pipeline script from SCM**
- SCM: **Git**
- Repository URL: `https://github.com/<YOUR_USERNAME>/HR-AI.git`
- Credentials: Select GitHub credentials (if private repo)
- Branch: `*/main` or `*/master`
- Script Path: `Jenkinsfile`

Click "Save"

## Test Jenkins Setup

### Test Docker Access

```bash
# SSH into Jenkins server
ssh -i hr-ai-key.pem ubuntu@<JENKINS_PUBLIC_IP>

# Test Docker as Jenkins user
sudo -u jenkins docker ps
sudo -u jenkins docker run hello-world
```

### Test AWS CLI Access

```bash
# Test AWS credentials (should use IAM role)
sudo -u jenkins aws sts get-caller-identity

# Test ECR access
sudo -u jenkins aws ecr describe-repositories --region us-east-1
```

### Test kubectl Access

```bash
# Test Kubernetes access
sudo -u jenkins kubectl get nodes
sudo -u jenkins kubectl get namespaces
```

### Test Build in Jenkins

1. Go to your pipeline job: `hr-ai-pipeline`
2. Click "Build Now"
3. Monitor the build in "Build History"
4. Click on the build number to see console output
5. Fix any errors that occur

## Configure GitHub Webhook (Optional)

For automatic builds on code push:

### In GitHub Repository:

1. Go to your repository on GitHub
2. Click "Settings" → "Webhooks" → "Add webhook"
3. Payload URL: `http://<JENKINS_PUBLIC_IP>:8080/github-webhook/`
4. Content type: `application/json`
5. Select: "Just the push event"
6. Active: Check
7. Click "Add webhook"

### In Jenkins:

1. Go to your pipeline job configuration
2. Under "Build Triggers", check:
   - "GitHub hook trigger for GITScm polling"
3. Save

## Jenkins Security Best Practices

### 1. Configure Security Realm

Go to **Manage Jenkins** → **Configure Global Security**

- Security Realm: **Jenkins' own user database**
- Authorization: **Matrix-based security**
  - Add your admin user with all permissions
  - Remove anonymous read access

### 2. Enable CSRF Protection

- Check "Prevent Cross Site Request Forgery exploits"
- Default Crumb Issuer

### 3. Configure Agent Protocols

- Disable deprecated protocols
- Use only "Inbound TCP Agent Protocol/4"

### 4. Set Up HTTPS (Production)

For production, configure HTTPS:

```bash
# Install Nginx
sudo apt-get install -y nginx

# Configure as reverse proxy with SSL
# See: https://www.jenkins.io/doc/book/system-administration/reverse-proxy-configuration-nginx/
```

## Backup Jenkins Configuration

### Manual Backup

```bash
# On Jenkins server
sudo tar -czf jenkins-backup-$(date +%Y%m%d).tar.gz /var/lib/jenkins/

# Exclude workspace and builds for smaller backup
sudo tar -czf jenkins-backup-$(date +%Y%m%d).tar.gz \
  --exclude=/var/lib/jenkins/workspace \
  --exclude=/var/lib/jenkins/jobs/*/builds \
  /var/lib/jenkins/
```

### Automated Backup (Recommended)

Install "ThinBackup" plugin:
1. Go to **Manage Jenkins** → **Manage Plugins**
2. Install "ThinBackup" plugin
3. Configure backup schedule in **Manage Jenkins** → **ThinBackup**

## Troubleshooting

### Jenkins Not Starting

```bash
# Check Jenkins status
sudo systemctl status jenkins

# Check Jenkins logs
sudo journalctl -u jenkins -f

# Restart Jenkins
sudo systemctl restart jenkins
```

### Permission Denied for Docker

```bash
# Verify Jenkins user is in docker group
sudo groups jenkins

# If not, add and restart
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

### kubectl Connection Refused

```bash
# Check kubeconfig
sudo -u jenkins cat /var/lib/jenkins/.kube/config

# Verify server address (should be master's public IP)
# Test connection
sudo -u jenkins kubectl cluster-info
```

### ECR Authentication Failed

```bash
# Test AWS credentials
sudo -u jenkins aws sts get-caller-identity

# Get ECR login
sudo -u jenkins aws ecr get-login-password --region us-east-1

# If fails, check IAM role is attached to instance
aws ec2 describe-instances --instance-ids <JENKINS_INSTANCE_ID> \
  --query 'Reservations[0].Instances[0].IamInstanceProfile'
```

### Build Fails with "No space left on device"

```bash
# Clean up Docker
sudo docker system prune -a -f

# Clean up Jenkins workspace
sudo rm -rf /var/lib/jenkins/workspace/*

# Check disk space
df -h
```

## Monitoring Jenkins

### Monitor System Resources

```bash
# Check CPU and memory usage
htop

# Check disk space
df -h

# Check Jenkins process
ps aux | grep jenkins
```

### Jenkins Built-in Monitoring

1. Install "Monitoring" plugin
2. Go to **Manage Jenkins** → **Monitoring**
3. View system metrics, JVM stats, etc.

## Scaling Jenkins (Optional)

For larger projects, consider:

1. **Jenkins Agents**: Add worker nodes for distributed builds
2. **Jenkins on Kubernetes**: Deploy Jenkins itself on K8s
3. **Blue Ocean Plugin**: Better UI for pipelines
4. **Pipeline Libraries**: Share common pipeline code

## Jenkins Maintenance

### Regular Tasks

1. **Update Jenkins**: Regularly check for updates in **Manage Jenkins**
2. **Update Plugins**: Keep plugins up to date
3. **Clean Workspace**: Periodically clean old workspaces
4. **Review Logs**: Check for errors or warnings
5. **Backup**: Regular backups of Jenkins configuration
6. **Monitor Resources**: Ensure enough CPU/memory/disk

### Monthly Checklist

- [ ] Update Jenkins core
- [ ] Update all plugins
- [ ] Review and clean old builds
- [ ] Check disk space
- [ ] Verify backups
- [ ] Review security settings
- [ ] Check build performance
- [ ] Review pipeline configurations

## Useful Jenkins CLI Commands

```bash
# Download Jenkins CLI
wget http://localhost:8080/jnlpJars/jenkins-cli.jar

# List jobs
java -jar jenkins-cli.jar -s http://localhost:8080/ -auth admin:password list-jobs

# Build job
java -jar jenkins-cli.jar -s http://localhost:8080/ -auth admin:password build hr-ai-pipeline

# Get build status
java -jar jenkins-cli.jar -s http://localhost:8080/ -auth admin:password get-job hr-ai-pipeline
```

## Integration with Other Tools

### Slack Notifications

1. Install "Slack Notification" plugin
2. Configure Slack workspace
3. Add Slack notification to Jenkinsfile

### Email Notifications

1. Go to **Manage Jenkins** → **Configure System**
2. Find "Extended E-mail Notification"
3. Configure SMTP server
4. Add email notification to Jenkinsfile

### SonarQube Integration (Code Quality)

1. Install "SonarQube Scanner" plugin
2. Configure SonarQube server
3. Add analysis step to pipeline

## Cost Optimization

1. **Stop Jenkins** when not in use (development environment)
2. **Clean up old builds** automatically
3. **Use spot instances** for Jenkins agents (advanced)
4. **Optimize build times** to reduce CPU usage

## Next Steps

After completing Jenkins setup:

1. ✅ Jenkins is running and accessible
2. ✅ Docker and kubectl are configured
3. ✅ Credentials are set up
4. ✅ Pipeline job is created
5. Update the Jenkinsfile for Kubernetes deployment
6. Test the complete CI/CD pipeline
7. Deploy the application to Kubernetes

## Summary

After completing this guide, you should have:
- ✅ Jenkins server running on EC2
- ✅ Docker installed and accessible to Jenkins
- ✅ kubectl configured for Kubernetes access
- ✅ AWS CLI with ECR access
- ✅ Required plugins installed
- ✅ Credentials configured (kubeconfig, GitHub, AWS)
- ✅ Pipeline job created
- ✅ Ready to run CI/CD pipeline

**Setup Time:** 30-45 minutes

**Jenkins URL:** `http://<JENKINS_PUBLIC_IP>:8080`

For detailed pipeline configuration, proceed to update the Jenkinsfile for Kubernetes deployment.

