pipeline {
    agent any
    
    environment {
        AWS_REGION = 'us-east-1'
        AWS_ACCOUNT_ID = sh(script: 'aws sts get-caller-identity --query Account --output text', returnStdout: true).trim()
        ECR_REPO = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/hr-ai"
        IMAGE_TAG = "${BUILD_NUMBER}"
        K8S_NAMESPACE = 'hr-ai'
    }
    
    stages {
        stage('Checkout') {
            steps {
                echo "Checking out source code..."
                checkout scm
            }
        }
        
        stage('Build Docker Image') {
            steps {
                script {
                    echo "Building Docker image..."
                    sh """
                        docker build -t ${ECR_REPO}:${IMAGE_TAG} .
                        docker tag ${ECR_REPO}:${IMAGE_TAG} ${ECR_REPO}:latest
                    """
                }
            }
        }
        
        stage('Push to ECR') {
            steps {
                script {
                    echo "Logging into Amazon ECR..."
                    sh """
                        aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPO}
                    """
                    
                    echo "Pushing Docker image to ECR..."
                    sh """
                        docker push ${ECR_REPO}:${IMAGE_TAG}
                        docker push ${ECR_REPO}:latest
                    """
                }
            }
        }
        
        stage('Deploy to Kubernetes') {
            steps {
                script {
                    echo "Deploying to Kubernetes cluster..."
                    
                    // Apply namespace
                    sh "kubectl apply -f k8s/namespace.yaml || true"
                    
                    // Apply ConfigMap
                    sh "kubectl apply -f k8s/configmap.yaml -n ${K8S_NAMESPACE}"
                    
                    // Apply Service
                    sh "kubectl get service hr-ai-service -n ${K8S_NAMESPACE} || kubectl apply -f k8s/service.yaml -n ${K8S_NAMESPACE}"
                    
                    // Update deployment with new image
                    sh """
                        sed 's|\\\${ECR_REPO}|${ECR_REPO}|g; s|\\\${IMAGE_TAG}|${IMAGE_TAG}|g' k8s/deployment.yaml | kubectl apply -f - -n ${K8S_NAMESPACE}
                    """
                }
            }
        }
        
        stage('Verify Deployment') {
            steps {
                script {
                    echo "Waiting for deployment to complete..."
                    sh "kubectl rollout status deployment/hr-ai-deployment -n ${K8S_NAMESPACE} --timeout=300s"
                    
                    echo "Deployment Status:"
                    sh "kubectl get deployment hr-ai-deployment -n ${K8S_NAMESPACE}"
                    sh "kubectl get pods -n ${K8S_NAMESPACE}"
                    sh "kubectl get service hr-ai-service -n ${K8S_NAMESPACE}"
                }
            }
        }
    }
    
    post {
        success {
            echo "=========================================="
            echo "Deployment completed successfully!"
            echo "Build Number: ${BUILD_NUMBER}"
            echo "Docker Image: ${ECR_REPO}:${IMAGE_TAG}"
            echo "=========================================="
        }
        
        failure {
            echo "=========================================="
            echo "Deployment failed!"
            echo "=========================================="
        }
        
        always {
            sh """
                docker rmi ${ECR_REPO}:${IMAGE_TAG} || true
                docker rmi ${ECR_REPO}:latest || true
                docker image prune -f || true
            """
        }
    }
}