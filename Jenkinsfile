pipeline {
    agent {
        label 'build-server'
    }

    environment {
        DOCKER_REPO_URL = "registry.apsissolutions.com/dev"
        DOCKER_HUB_CREDENTIALS = "private-docker-repo"
        CONTAINER_NAME = "dev-error-page"
        IMAGE_TAG = "latest"
        DOCKER_IMAGE = "${DOCKER_REPO_URL}/${CONTAINER_NAME}:${IMAGE_TAG}"
        CONTAINER_PORT = "3000"
        HOST_PORT = "3030"
        RESTART_POLICY = "always"
        NETWORK_NAME = "bridge"
        
        // Email addresses for notifications
        RECIPIENT_EMAILS = "report.infra@apsissolutions.com, recipient2@example.com"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build and Push Docker Image') {
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: env.DOCKER_CREDENTIALS_ID, usernameVariable: 'DOCKER_USERNAME', passwordVariable: 'DOCKER_PASSWORD')]) {
                        sh '''
                            #!/bin/bash
                            echo "Logging in to private Docker registry..."
                            echo $DOCKER_PASSWORD | docker login -u $DOCKER_USERNAME --password-stdin ${DOCKER_REPO_URL}
                            docker build -t ${DOCKER_IMAGE} -f Dockerfile .
                            docker push ${DOCKER_IMAGE}
                        '''
                    }
                }
            }
        }

        stage('Deploy Docker Container on Deployment Server') {
            agent {
                label 'deployment-server'
            }
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: env.DOCKER_CREDENTIALS_ID, usernameVariable: 'DOCKER_USERNAME', passwordVariable: 'DOCKER_PASSWORD')]) {
                        sh '''
                            #!/bin/bash
                            echo $DOCKER_PASSWORD | docker login -u $DOCKER_USERNAME --password-stdin ${DOCKER_REPO_URL}
                            docker pull ${DOCKER_IMAGE}
                            docker stop ${CONTAINER_NAME} || true
                            docker rm ${CONTAINER_NAME} || true
                            docker run --restart ${RESTART_POLICY} --name ${CONTAINER_NAME} --network ${NETWORK_NAME} -p ${HOST_PORT}:${CONTAINER_PORT} -d ${DOCKER_IMAGE}
                        '''
                    }
                }
            }
        }
    }

    post {
        always {
            script {
                // Get agent IP address
                def agentIP = sh(script: 'hostname -I | awk \'{print $1}\'', returnStdout: true).trim()
                
                // Send email notification
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
                      <li>This application is locally hosted on <a href="http://${agentIP}:${HOST_PORT}">http://${agentIP}:${HOST_PORT}</a></li>
                    </ul>
                    """,
                    to: "${RECIPIENT_EMAILS}",
                    mimeType: 'text/html',
                    attachLog: true
                )
            }
        }
    }
}
