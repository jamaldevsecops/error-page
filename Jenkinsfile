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

        // DO NOT CHANGE BELOW
        DOCKER_REPO_URL = "registry.apsissolutions.com"
        DOCKER_IMAGE = "${DOCKER_REPO_URL}/${DEPLOYMENT_TYPE}/${CONTAINER_NAME}:${IMAGE_TAG}"
        DOCKER_HUB_CREDENTIALS = "private-docker-repo"
        RESTART_POLICY = "always"
        NETWORK_NAME = "bridge"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: DOCKER_HUB_CREDENTIALS, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        def buildStatus = sh(script: """
                            echo "$DOCKER_PASS" | docker login ${DOCKER_REPO_URL} -u "$DOCKER_USER" --password-stdin
                            echo "Building Docker image..."
                            docker build -t ${DOCKER_IMAGE} -f Dockerfile . || exit 1
                            echo "Pushing Docker image to private repository..."
                            docker push ${DOCKER_IMAGE} || exit 1
                            docker logout
                        """, returnStatus: true)

                        if (buildStatus != 0) {
                            error "Failed to build or push Docker image: ${DOCKER_IMAGE}."
                        } else {
                            echo "Docker image built and pushed successfully: ${DOCKER_IMAGE}."
                        }
                    }
                }
            }
        }

        stage('Deploy Docker Container on Deployment Server') {
            agent {
                label 'QA1'
            }
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: DOCKER_HUB_CREDENTIALS, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        def deployStatus = sh(script: """
                            echo "$DOCKER_PASS" | docker login ${DOCKER_REPO_URL} -u "$DOCKER_USER" --password-stdin
                            echo "Checking if the container ${CONTAINER_NAME} is already running..."
                            
                            if [ \$(docker ps -q -f name=${CONTAINER_NAME}) ]; then
                                echo "Container ${CONTAINER_NAME} is already running. Stopping and removing it..."
                                docker stop ${CONTAINER_NAME}
                                docker rm ${CONTAINER_NAME}
                            else
                                echo "No existing container found with name ${CONTAINER_NAME}."
                            fi
                            
                            echo "Pulling Docker image..."
                            docker pull ${DOCKER_IMAGE} || exit 1
                            
                            echo "Starting a new container..."
                            docker run --restart ${RESTART_POLICY} --name ${CONTAINER_NAME} --network ${NETWORK_NAME} -p ${HOST_PORT}:${CONTAINER_PORT} -d ${DOCKER_IMAGE} || exit 1
                            
                            docker logout
                        """, returnStatus: true)

                        if (deployStatus != 0) {
                            error "Failed to deploy Docker container: ${CONTAINER_NAME}."
                        } else {
                            echo "Docker container deployed successfully: ${CONTAINER_NAME}."
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            script {
                // Retrieve the IP address of the deployment server
                def deploymentIP = ''
                node('QA1') {
                    deploymentIP = sh(script: 'hostname -I | awk \'{print $1}\'', returnStdout: true).trim()
                }
    
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
                      <li>Access This App Locally: <a href="http://${deploymentIP}:${HOST_PORT}">http://${deploymentIP}:${HOST_PORT}</a></li>
                      <li>Access Live Container Log: <a href="http://${deploymentIP}:${HOST_PORT}">http://${deploymentIP}:${HOST_PORT}</a></li>
                    </ul>
                    """,
                    to: RECIPIENT_EMAILS,
                    mimeType: 'text/html',
                    attachLog: true
                )
            }
        }
    }

}
