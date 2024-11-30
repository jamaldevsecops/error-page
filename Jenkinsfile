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
        TRIVY_FS_SCAN_REPORT = "trivy_filesystem_scan_report.txt"
        TRIVY_IMAGE_SCAN_REPORT = "trivy_docker_image_scan_report.txt"
        TRIVY_SEVERITY = "HIGH,CRITICAL"
    }

    stages {
        stage('Checkout Code') {
            steps {
                echo 'Checking out code...'
                checkout scm
            }
        }

        stage('Trivy Filesystem Scan') {
            steps {
                script {
                    echo 'Running Trivy filesystem scan...'
                    def fsScanStatus = sh(script: """
                        trivy fs --no-progress --exit-code 0 --format table . > ${TRIVY_FS_SCAN_REPORT}
                    """, returnStatus: true)
        
                    // Debug: Check if report is blank
                    def reportIsBlank = sh(script: "wc -l < ${TRIVY_FS_SCAN_REPORT}", returnStdout: true).trim().toInteger() == 0
        
                    if (reportIsBlank) {
                        echo 'Filesystem scan report is blank. Adding default content.'
                        sh "echo 'No vulnerabilities found in filesystem scan.' > ${TRIVY_FS_SCAN_REPORT}"
                    } else {
                        echo 'Filesystem scan completed with findings.'
                    }
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: DOCKER_HUB_CREDENTIALS, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        echo 'Building Docker image...'
                        def buildStatus = sh(script: """
                            echo "$DOCKER_PASS" | docker login ${DOCKER_REPO_URL} -u "$DOCKER_USER" --password-stdin
                            docker build -t ${DOCKER_IMAGE} -f Dockerfile . || exit 1
                            docker logout
                        """, returnStatus: true)

                        if (buildStatus != 0) {
                            error "Failed to build Docker image: ${DOCKER_IMAGE}."
                        } else {
                            echo "Docker image built successfully: ${DOCKER_IMAGE}."
                        }
                    }
                }
            }
        }

        stage('Trivy Image Scan') {
            steps {
                script {
                    echo 'Running Trivy docker image scan...'
                    def imageScanStatus = sh(script: """
                        trivy image --severity ${TRIVY_SEVERITY} --no-progress --exit-code 0 --format table ${DOCKER_IMAGE} > ${TRIVY_IMAGE_SCAN_REPORT}
                    """, returnStatus: true)

                    // Debug: Check if the report file exists and its content
                    sh "ls -l ${TRIVY_IMAGE_SCAN_REPORT}"
                    sh "cat ${TRIVY_IMAGE_SCAN_REPORT}"

                    if (imageScanStatus == 0) {
                        echo 'Trivy docker image scan completed successfully. Vulnerabilities found but the pipeline will not fail.'
                    } else {
                        echo 'Trivy docker image scan failed. Continuing the pipeline.'
                    }
                }
            }
        }

        stage('Push Docker Image') {
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: DOCKER_HUB_CREDENTIALS, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        echo 'Pushing Docker image to the repository...'
                        def pushStatus = sh(script: """
                            echo "$DOCKER_PASS" | docker login ${DOCKER_REPO_URL} -u "$DOCKER_USER" --password-stdin
                            docker push ${DOCKER_IMAGE} || exit 1
                            docker logout
                        """, returnStatus: true)

                        if (pushStatus != 0) {
                            error "Failed to push Docker image: ${DOCKER_IMAGE}."
                        } else {
                            echo "Docker image pushed successfully: ${DOCKER_IMAGE}."
                        }
                    }
                }
            }
        }

        stage('Pull Docker Image on Deployment Server') {
            agent {
                label 'QA1'
            }
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: DOCKER_HUB_CREDENTIALS, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        echo 'Pulling Docker image on deployment server...'
                        def pullStatus = sh(script: """
                            echo "$DOCKER_PASS" | docker login ${DOCKER_REPO_URL} -u "$DOCKER_USER" --password-stdin
                            docker pull ${DOCKER_IMAGE} || exit 1
                            docker logout
                        """, returnStatus: true)

                        if (pullStatus != 0) {
                            error "Failed to pull Docker image on deployment server: ${DOCKER_IMAGE}."
                        } else {
                            echo "Docker image pulled successfully on deployment server: ${DOCKER_IMAGE}."
                        }
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
                    withCredentials([usernamePassword(credentialsId: DOCKER_HUB_CREDENTIALS, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        echo 'Deploying Docker container...'
                        def deployStatus = sh(script: """
                            echo "Checking if the container ${CONTAINER_NAME} is running..."
                            if [ \$(docker ps -q -f name=${CONTAINER_NAME}) ]; then
                                echo "Stopping and removing existing container: ${CONTAINER_NAME}."
                                docker stop ${CONTAINER_NAME}
                                docker rm ${CONTAINER_NAME}
                            else
                                echo "No running container found with name ${CONTAINER_NAME}."
                            fi
                            echo "Starting new Docker container..."
                            docker run --restart ${RESTART_POLICY} --name ${CONTAINER_NAME} --network ${NETWORK_NAME} -p ${HOST_PORT}:${CONTAINER_PORT} -d ${DOCKER_IMAGE} || exit 1
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
                      <li>Access Live App Log: <a href="http://${deploymentIP}:8080">http://${deploymentIP}:8080</a></li>
                    </ul>
                    <p><b>Trivy Vulnerability Scan Reports:</b></p>
                    <p>See the attached Trivy scan reports for details on vulnerabilities found in the Docker image and filesystem.</p>
                    """,
                    to: RECIPIENT_EMAILS,
                    mimeType: 'text/html',
                    attachLog: true,
                    attachmentsPattern: "${env.TRIVY_IMAGE_SCAN_REPORT},${env.TRIVY_FS_SCAN_REPORT}"
                )
            }
        }
    }
}
