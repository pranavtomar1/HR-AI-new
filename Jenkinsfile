pipeline {
    agent any
    
    environment {
        AWS_REGION = 'us-east-1'
        AWS_ACCOUNT_ID = sh(script: 'aws sts get-caller-identity --query Account --output text', returnStdout: true).trim()
        ECR_REPO = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/hr-ai"
        IMAGE_TAG = "${BUILD_NUMBER}"
        K8S_NAMESPACE = 'hr-ai'
        KUBECONFIG = credentials('kubeconfig')
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
                    try {
                        echo "Building Docker image..."
                        sh """
                            docker build -t ${ECR_REPO}:${IMAGE_TAG} .
                            docker tag ${ECR_REPO}:${IMAGE_TAG} ${ECR_REPO}:latest
                        """
                        echo "Docker image built successfully: ${ECR_REPO}:${IMAGE_TAG}"
                    } catch (Exception e) {
                        error "Failed to build Docker image: ${e.message}"
                    }
                }
            }
        }
        
        stage('Push to ECR') {
            steps {
                script {
                    try {
                        echo "Logging into Amazon ECR..."
                        sh """
                            aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPO}
                        """
                        
                        echo "Pushing Docker image to ECR..."
                        sh """
                            docker push ${ECR_REPO}:${IMAGE_TAG}
                            docker push ${ECR_REPO}:latest
                        """
                        echo "Docker image pushed successfully to ECR"
                    } catch (Exception e) {
                        error "Failed to push image to ECR: ${e.message}"
                    }
                }
            }
        }
        
        stage('Update Kubernetes Manifests') {
            steps {
                script {
                    try {
                        echo "Updating Kubernetes deployment manifest with new image..."
                        sh """
                            # Create a temporary manifest with the new image
                            sed 's|\${ECR_REPO}|\${ECR_REPO}|g; s|\${IMAGE_TAG}|${IMAGE_TAG}|g' k8s/deployment.yaml > k8s/deployment-${BUILD_NUMBER}.yaml
                            
                            # Display the manifest for verification
                            echo "=== Updated Deployment Manifest ==="
                            cat k8s/deployment-${BUILD_NUMBER}.yaml
                        """
                    } catch (Exception e) {
                        error "Failed to update manifests: ${e.message}"
                    }
                }
            }
        }
        
        stage('Deploy to Kubernetes') {
            steps {
                script {
                    try {
                        echo "Deploying to Kubernetes cluster..."
                        
                        // Create namespace if it doesn't exist
                        sh """
                            kubectl apply -f k8s/namespace.yaml || true
                        """
                        
                        // Apply ConfigMap
                        sh """
                            kubectl apply -f k8s/configmap.yaml -n ${K8S_NAMESPACE}
                        """
                        
                        // Apply Service (only if not exists, to preserve NodePort)
                        sh """
                            kubectl get service hr-ai-service -n ${K8S_NAMESPACE} || kubectl apply -f k8s/service.yaml -n ${K8S_NAMESPACE}
                        """
                        
                        // Apply Deployment with new image
                        sh """
                            # Replace variables in deployment
                            export ECR_REPO=${ECR_REPO}
                            export IMAGE_TAG=${IMAGE_TAG}
                            envsubst < k8s/deployment.yaml | kubectl apply -f - -n ${K8S_NAMESPACE}
                        """
                        
                        echo "Deployment applied successfully"
                    } catch (Exception e) {
                        error "Failed to deploy to Kubernetes: ${e.message}"
                    }
                }
            }
        }
        
        stage('Verify Deployment') {
            steps {
                script {
                    try {
                        echo "Waiting for deployment to complete..."
                        sh """
                            # Wait for deployment to be ready (timeout: 5 minutes)
                            kubectl rollout status deployment/hr-ai-deployment -n ${K8S_NAMESPACE} --timeout=300s
                        """
                        
                        echo "Checking deployment status..."
                        sh """
                            echo "=== Deployment Status ==="
                            kubectl get deployment hr-ai-deployment -n ${K8S_NAMESPACE}
                            
                            echo ""
                            echo "=== Pods Status ==="
                            kubectl get pods -n ${K8S_NAMESPACE} -l app=hr-ai
                            
                            echo ""
                            echo "=== Service Status ==="
                            kubectl get service hr-ai-service -n ${K8S_NAMESPACE}
                            
                            echo ""
                            echo "=== Recent Events ==="
                            kubectl get events -n ${K8S_NAMESPACE} --sort-by='.lastTimestamp' | tail -10
                        """
                        
                        // Get service URL
                        def nodePort = sh(
                            script: "kubectl get service hr-ai-service -n ${K8S_NAMESPACE} -o jsonpath='{.spec.ports[0].nodePort}'",
                            returnStdout: true
                        ).trim()
                        
                        echo "=== Application Access ==="
                        echo "Application is accessible at: http://<NODE_IP>:${nodePort}"
                        echo "Use any Kubernetes node IP to access the application"
                        
                    } catch (Exception e) {
                        error "Deployment verification failed: ${e.message}"
                    }
                }
            }
        }
        
        stage('Health Check') {
            steps {
                script {
                    try {
                        echo "Performing health check..."
                        sh """
                            # Check if pods are running
                            RUNNING_PODS=\$(kubectl get pods -n ${K8S_NAMESPACE} -l app=hr-ai --field-selector=status.phase=Running --no-headers | wc -l)
                            DESIRED_REPLICAS=\$(kubectl get deployment hr-ai-deployment -n ${K8S_NAMESPACE} -o jsonpath='{.spec.replicas}')
                            
                            echo "Running pods: \$RUNNING_PODS"
                            echo "Desired replicas: \$DESIRED_REPLICAS"
                            
                            if [ "\$RUNNING_PODS" -ge "\$DESIRED_REPLICAS" ]; then
                                echo "Health check passed: All pods are running"
                            else
                                echo "Health check warning: Not all pods are running yet"
                                kubectl describe pods -n ${K8S_NAMESPACE} -l app=hr-ai
                                exit 1
                            fi
                        """
                    } catch (Exception e) {
                        error "Health check failed: ${e.message}"
                    }
                }
            }
        }
    }
    
    post {
        success {
            echo "=========================================="
            echo "Deployment completed successfully!"
            echo "=========================================="
            echo "Build Number: ${BUILD_NUMBER}"
            echo "Docker Image: ${ECR_REPO}:${IMAGE_TAG}"
            echo "Namespace: ${K8S_NAMESPACE}"
            echo ""
            script {
                try {
                    def nodePort = sh(
                        script: "kubectl get service hr-ai-service -n ${K8S_NAMESPACE} -o jsonpath='{.spec.ports[0].nodePort}'",
                        returnStdout: true
                    ).trim()
                    echo "Access URL: http://<NODE_IP>:${nodePort}"
                } catch (Exception e) {
                    echo "Could not retrieve service endpoint"
                }
            }
            echo "=========================================="
        }
        
        failure {
            echo "=========================================="
            echo "Deployment failed!"
            echo "=========================================="
            echo "Check the logs above for error details"
            script {
                try {
                    sh """
                        echo "=== Failed Pods Logs ==="
                        kubectl get pods -n ${K8S_NAMESPACE} -l app=hr-ai
                        
                        # Get logs from failed pods
                        for pod in \$(kubectl get pods -n ${K8S_NAMESPACE} -l app=hr-ai -o name); do
                            echo "Logs for \$pod:"
                            kubectl logs \$pod -n ${K8S_NAMESPACE} --tail=50 || true
                        done
                    """
                } catch (Exception e) {
                    echo "Could not retrieve pod logs"
                }
            }
        }
        
        always {
            echo "Cleaning up..."
            sh """
                # Clean up Docker images to save space
                docker rmi ${ECR_REPO}:${IMAGE_TAG} || true
                docker rmi ${ECR_REPO}:latest || true
                
                # Clean up temporary files
                rm -f k8s/deployment-${BUILD_NUMBER}.yaml || true
                
                # Prune old Docker images (keep last 3 builds worth)
                docker image prune -f || true
            """
            
            // Clean up workspace (optional, uncomment if needed)
            // cleanWs()
        }
    }
}
