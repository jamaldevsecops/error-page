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
        RECIPIENT_EMAILS = "jamal.hossain@apsissolutions.com"

        FTP_HOST = "192.168.10.50:21"
        FTP_PATH = "/ENV_FILE/crm-issue-tracker/staging/crm-issue-tracker-frontend"
        LOCAL_PATH = "."

        // DO NOT CHANGE BELOW
        DOCKER_REPO_URL = "registry.apsissolutions.com"
        DOCKER_IMAGE = "${DOCKER_REPO_URL}/${DEPLOYMENT_TYPE}/${CONTAINER_NAME}:${IMAGE_TAG}"
        DOCKER_HUB_CREDENTIALS = "private-docker-repo"
        RESTART_POLICY = "always"
        NETWORK_NAME = "bridge"
        TRIVY_FS_SCAN_REPORT = "filesystem_vulnerability_report.txt"
        TRIVY_IMAGE_SCAN_REPORT = "docker_image_vulnerability_report.txt"
        TRIVY_SEVERITY = "HIGH,CRITICAL"
    }

    stages {
        stage('Checkout Code') {
            steps {
                echo 'Checking out code...'
                checkout scm
            }
        }

        stage('Download .env File') {
            steps {
                script {
                    echo 'Downloading .env file from FTP...'
                    withCredentials([usernamePassword(credentialsId: 'crm-ftp-credentials', usernameVariable: 'FTP_USER', passwordVariable: 'FTP_PASSWORD')]) {
                        def ftpStatus = sh(script: '''
                            curl -u "$FTP_USER":"$FTP_PASSWORD" "ftp://$FTP_HOST$FTP_PATH/.env" -o "$LOCAL_PATH"/.env
                        ''', returnStatus: true)

                        if (ftpStatus != 0) {
                            error "Failed to download the .env file from FTP."
                        } else {
                            echo "Downloaded .env file to ${LOCAL_PATH}/.env."
                        }
                    }
                }
            }
        }

        stage('Trivy Filesystem Scan') {
            steps {
                script {
                    echo 'Running Trivy filesystem scan...'
                    sh """
                        trivy fs --no-progress --exit-code 0 --format table . > ${TRIVY_FS_SCAN_REPORT}
                    """
                    if (!fileExists("${TRIVY_FS_SCAN_REPORT}") || 
                        sh(script: "wc -l < ${TRIVY_FS_SCAN_REPORT}", returnStdout: true).trim().toInteger() == 0) {
                        sh "echo 'No high or critical vulnerabilities found in filesystem scan.' > ${TRIVY_FS_SCAN_REPORT}"
                    }
                    echo "Filesystem scan report saved at: ${TRIVY_FS_SCAN_REPORT}"
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: DOCKER_HUB_CREDENTIALS, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        echo 'Building Docker image...'
                        sh """
                            echo "$DOCKER_PASS" | docker login ${DOCKER_REPO_URL} -u "$DOCKER_USER" --password-stdin
                            docker build -t ${DOCKER_IMAGE} -f Dockerfile . || exit 1
                            docker logout ${DOCKER_REPO_URL}
                        """
                    }
                }
            }
        }

        stage('Trivy Docker Image Scan') {
            steps {
                script {
                    echo 'Running Trivy Docker Image scan...'
                    sh """
                        trivy image --severity ${TRIVY_SEVERITY} --no-progress --exit-code 0 --format table ${DOCKER_IMAGE} > ${TRIVY_IMAGE_SCAN_REPORT}
                    """
                    if (!fileExists("${TRIVY_IMAGE_SCAN_REPORT}") || 
                        sh(script: "wc -l < ${TRIVY_IMAGE_SCAN_REPORT}", returnStdout: true).trim().toInteger() == 0) {
                        sh "echo 'No high or critical vulnerabilities found in Docker Image scan.' > ${TRIVY_IMAGE_SCAN_REPORT}"
                    }
                    echo "Docker Image scan report saved at: ${TRIVY_IMAGE_SCAN_REPORT}"
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
                            docker push ${DOCKER_IMAGE} || exit 1
                            docker logout ${DOCKER_REPO_URL}
                        """
                    }
                }
            }
        }

        stage('Pull Docker Image on Deployment Server') {
            agent {
                label 'ERP-DEV' // Deployment server node
            }
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: DOCKER_HUB_CREDENTIALS, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        echo 'Pulling Docker image on the deployment server...'
                        sh """
                            echo "$DOCKER_PASS" | docker login ${DOCKER_REPO_URL} -u "$DOCKER_USER" --password-stdin
                            docker pull ${DOCKER_IMAGE} || exit 1
                            docker logout registry.apsissolutions.com
                        """

                        echo 'Stopping and removing existing Docker container if it exists...'
                        def isRunning = sh(script: "docker inspect -f '{{.State.Running}}' ${CONTAINER_NAME}", returnStatus: true)
                        if (isRunning == 0) {
                            echo "Container ${CONTAINER_NAME} is running. Stopping and removing it..."
                            sh """
                                docker stop ${CONTAINER_NAME}
                                docker rm ${CONTAINER_NAME}
                            """
                        } else {
                            echo "Container ${CONTAINER_NAME} is not running, no need to stop or remove."
                        }

                        echo 'Deploying Docker container...'
                        sh """
                            docker run --restart ${RESTART_POLICY} --name ${CONTAINER_NAME} --network ${NETWORK_NAME} -p ${HOST_PORT}:${CONTAINER_PORT} -d ${DOCKER_IMAGE}
                        """
                    }

                    // Retrieve the IP address of the deployment server
                    def deploymentIP = sh(script: 'hostname -I | awk \'{print $1}\'', returnStdout: true).trim()
                    echo "Deployment server IP: ${deploymentIP}"

                    // Save the deploymentIP in the environment variable for the post stage
                    env.DEPLOYMENT_IP = deploymentIP
                }
            }
        }

    }

    post {
        success {
            script {
                echo 'Sending success email with scan reports...'
                emailext(
                    subject: "Jenkins Build Successful: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                    body: """
                    <p><b>Build Successful:</b></p>
                    <ul>
                        <li>Job Name: ${env.JOB_NAME}</li>
                        <li>Build Number: ${env.BUILD_NUMBER}</li>
                        <li>Console Output: <a href="${env.BUILD_URL}console">${env.BUILD_URL}console</a></li>
                        <li>Access This App Locally: <a href="http://${env.DEPLOYMENT_IP}:${HOST_PORT}">http://${env.DEPLOYMENT_IP}:${HOST_PORT}</a></li>
                        <li>Access Live App Log: <a href="http://${env.DEPLOYMENT_IP}:8080">http://${env.DEPLOYMENT_IP}:8080</a></li>
                    </ul>
                    <p><b>Trivy Vulnerability Scan Reports:</b></p>
                    <p>See the attached Trivy scan reports for details on vulnerabilities found in the Docker image and filesystem.</p>
                    """,
                    to: RECIPIENT_EMAILS,
                    mimeType: 'text/html',
                    attachmentsPattern: "${TRIVY_FS_SCAN_REPORT},${TRIVY_IMAGE_SCAN_REPORT}"
                )
            }
        }
        failure {
            script {
                echo 'Sending failure email with build log...'
                emailext(
                    subject: "Jenkins Build Failed: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                    body: """
                    <p><b>Build Failed:</b></p>
                    <ul>
                        <li>Job Name: ${env.JOB_NAME}</li>
                        <li>Build Number: ${env.BUILD_NUMBER}</li>
                        <li>Console Output: <a href="${env.BUILD_URL}console">${env.BUILD_URL}console</a></li>
                    </ul>
                    <p>See the attached build log for details.</p>
                    """,
                    to: RECIPIENT_EMAILS,
                    mimeType: 'text/html',
                    attachLog: true
                )
            }
        }
    }

}
