pipeline {
    agent {
        label 'BUILD-SERVER'
    }
    environment {
        CONTAINER_NAME = "dev-error-page" //change me
        IMAGE_TAG = "latest"
        CONTAINER_PORT = "3030"          //change me
        HOST_PORT = "3030" 
        NETWORK_NAME = "bridge"
        RESTART_POLICY = "always"
        DOCKER_FILENAME = "Dockerfile"	//change me
        RECIPIENT_EMAILS = "jamal.hossain@apsissolutions.com"

        FTP_HOST = "192.168.10.50:21" 
        FTP_PATH = "/ENV_FILE/bracu/develop/bracu-frontend"
        LOCAL_PATH = "." 

        TARGET_SERVER = "ERP-DEV" //change me
        TARGET_USER = "devops"
        DOCKER_HUB_USERNAME = "apsissolutions"
        DOCKER_IMAGE = "${env.DOCKER_HUB_USERNAME}/${env.CONTAINER_NAME}:${env.IMAGE_TAG}"

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
/*
        stage('Download .env File') { 
            steps { 
                script { 
                    echo 'Downloading .env file from FTP...' 
                    withCredentials([usernamePassword(credentialsId: 'erp-ftp-credentials', usernameVariable: 'FTP_USER', passwordVariable: 'FTP_PASSWORD')]) { 
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
                        trivy fs --no-progress --severity ${TRIVY_SEVERITY} --exit-code 1 --format table . > ${TRIVY_FS_SCAN_REPORT}
                    """
                    echo "Filesystem scan report saved at: ${TRIVY_FS_SCAN_REPORT}"
                }
            }
        }
*/
        stage('Build Docker Image') {
            steps {
                script {
                    echo 'Building Docker image...'
                    sh """
                        docker build -t ${DOCKER_IMAGE} -f ${DOCKER_FILENAME} .
                    """
                    echo "Docker image built successfully: ${DOCKER_IMAGE}"
                }
            }
        }
/*
        stage('Trivy Docker Image Scan') {
            steps {
                script {
                    echo 'Running Trivy Docker Image scan...'
                    sh """
                        trivy image --severity ${TRIVY_SEVERITY} --no-progress --exit-code 1 --format table ${DOCKER_IMAGE} > ${TRIVY_IMAGE_SCAN_REPORT}
                    """
                    echo "Docker Image scan report saved at: ${TRIVY_IMAGE_SCAN_REPORT}"
                }
            }
        }
*/
        stage('Transfer Docker Image') {
            steps {
                script {
                    echo "Transferring Docker image to target server: ${TARGET_SERVER}..."
                    sh """
                        docker save ${DOCKER_IMAGE} | ssh ${TARGET_USER}@${TARGET_SERVER} 'docker load'
                    """
                    echo "Docker image transferred successfully to ${TARGET_SERVER}."
                }
            }
        }

        stage('Deploy Docker Container') {
            agent {
                label 'ERP-DEV' // Change me
            }
            steps {
                script {
                    echo 'Checking if the Docker network exists...'
                    def networkExists = sh(script: "docker network ls --filter name=^${NETWORK_NAME}\$ --format '{{.Name}}' | grep -w ${NETWORK_NAME} || true", returnStdout: true).trim()
                    if (networkExists) {
                        echo "Docker network '${NETWORK_NAME}' already exists."
                    } else {
                        echo "Creating Docker network '${NETWORK_NAME}'..."
                        sh "docker network create --driver bridge ${NETWORK_NAME}"
                    }

                    echo 'Stopping and removing existing Docker container if it exists...'
                    sh """
                        docker stop ${CONTAINER_NAME} || true
                        docker rm ${CONTAINER_NAME} || true
                    """

                    echo 'Deploying Docker container...'
                    sh """
                        docker run --restart ${RESTART_POLICY} --name ${CONTAINER_NAME} --network ${NETWORK_NAME} \
                            -p ${HOST_PORT}:${CONTAINER_PORT} --security-opt no-new-privileges:true \
                            --pids-limit 50 --health-cmd='stat /etc/passwd || exit 1' -d ${DOCKER_IMAGE}
                    """

                    def deploymentIP = sh(script: "hostname -I | tr ' ' '\\n' | grep '^192\\.168\\.'", returnStdout: true).trim()
                    echo "Deployment server IP: ${deploymentIP}"
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
