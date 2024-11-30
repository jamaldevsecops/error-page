pipeline {
    agent {
        label 'BUILD-SERVER'
    }

    environment {
        DEPLOYMENT_TYPE = "dev"
        CONTAINER_NAME = "dev-error-page"
        IMAGE_TAG = "latest"
        CONTAINER_PORT = "3000"
        HOST_PORT = "3030"
        RECIPIENT_EMAILS = "report.infra@apsissolutions.com, recipient2@example.com"
        TRIVY_SEVERITY = "HIGH,CRITICAL"
        TRIVY_REPORT = "trivy_scan_report.txt"

        DOCKER_REPO_URL = "registry.apsissolutions.com"
        DOCKER_IMAGE = "${DOCKER_REPO_URL}/${DEPLOYMENT_TYPE}/${CONTAINER_NAME}:${IMAGE_TAG}"
        DOCKER_HUB_CREDENTIALS = "private-docker-repo"
        RESTART_POLICY = "always"
        NETWORK_NAME = "bridge"
    }

    stages {
        stage('Checkout Code') {
            steps {
                echo 'Checking out code...'
                checkout scm
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: DOCKER_HUB_CREDENTIALS, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        echo 'Building Docker image...'
                        sh """
                            echo "$DOCKER_PASS" | docker login ${DOCKER_REPO_URL} -u "$DOCKER_USER" --password-stdin
                            docker build -t ${DOCKER_IMAGE} -f Dockerfile .
                            docker logout
                        """
                    }
                }
            }
        }

        stage('Trivy Scan') {
            steps {
                script {
                    echo 'Running Trivy scan...'
                    
                    // Run Trivy and capture the output
                    def trivyOutput = sh(script: """
                        trivy image --severity ${TRIVY_SEVERITY} --no-progress --format table ${DOCKER_IMAGE}
                    """, returnStdout: true).trim()
                    
                    // Save the output to a file
                    writeFile file: "${TRIVY_REPORT}", text: trivyOutput
                    
                    // Display the scan results in the console
                    echo "Trivy Scan Results:\n${trivyOutput}"
                    
                    // Check if vulnerabilities were found
                    if (trivyOutput.contains("VULNERABILITIES")) {
                        echo "Vulnerabilities found in the Docker image."
                    } else {
                        echo "No vulnerabilities found in the Docker image."
                    }
                }
            }
        }

        stage('Push Docker Image') {
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: DOCKER_HUB_CREDENTIALS, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        echo 'Pushing Docker image to the repository...'
                        sh """
                            echo "$DOCKER_PASS" | docker login ${DOCKER_REPO_URL} -u "$DOCKER_USER" --password-stdin
                            docker push ${DOCKER_IMAGE}
                            docker logout
                        """
                    }
                }
            }
        }

        stage('Deploy Docker Container') {
            agent {
                label 'QA1'
            }
            steps {
                script {
                    echo 'Deploying Docker container...'
                    sh """
                        docker stop ${CONTAINER_NAME} || true
                        docker rm ${CONTAINER_NAME} || true
                        docker run --restart ${RESTART_POLICY} --name ${CONTAINER_NAME} --network ${NETWORK_NAME} -p ${HOST_PORT}:${CONTAINER_PORT} -d ${DOCKER_IMAGE}
                    """
                }
            }
        }
    }

    post {
        always {
            script {
                echo 'Sending email notification...'
                emailext(
                    subject: "Jenkins Build Notification: ${currentBuild.currentResult}",
                    body: """
                    <p><b>Build Information:</b></p>
                    <ul>
                      <li>Job Name: ${env.JOB_NAME}</li>
                      <li>Build Number: ${env.BUILD_NUMBER}</li>
                      <li>Status: ${currentBuild.currentResult}</li>
                      <li>Console Output: <a href="${env.BUILD_URL}console">${env.BUILD_URL}console</a></li>
                    </ul>
                    <p><b>Trivy Report:</b> See the attachment for details.</p>
                    """,
                    to: RECIPIENT_EMAILS,
                    mimeType: 'text/html',
                    attachmentsPattern: "${TRIVY_REPORT}"
                )
            }
        }
    }
}
