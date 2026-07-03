pipeline {
    agent any

    environment {
        REMOTE_HOST = '192.168.100.227'
        REMOTE_USER = 'terence'
        DEPLOY_DIR  = '/home/pixxel'
        APP_PORT    = '3000'
    }

    triggers {
        GenericTrigger(
            token: 'gxkhsonsjafbmlbcqrauryeomwjksgsb'
        )
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Verify') {
            steps {
                sh """
                    npm ci
                    npx tsc --noEmit
                    npm run lint
                    npm test
                """
            }
        }

        stage('Write .env') {
            steps {
                withCredentials([
                    string(credentialsId: 'PIXXEL_DB_HOST',         variable: 'DB_HOST'),
                    string(credentialsId: 'PIXXEL_DB_PORT',         variable: 'DB_PORT'),
                    string(credentialsId: 'PIXXEL_DB_USER',         variable: 'DB_USER'),
                    string(credentialsId: 'PIXXEL_DB_PASSWORD',     variable: 'DB_PASSWORD'),
                    string(credentialsId: 'PIXXEL_DB_NAME',         variable: 'DB_NAME'),
                    string(credentialsId: 'PIXXEL_NEXTAUTH_SECRET', variable: 'NEXTAUTH_SECRET'),
                    string(credentialsId: 'PIXXEL_NEXTAUTH_URL',    variable: 'NEXTAUTH_URL')
                ]) {
                    sshagent(credentials: ['PIXXEL_SSH_KEY']) {
                        sh """
                            ssh -o StrictHostKeyChecking=no ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${DEPLOY_DIR}"
                            ssh ${REMOTE_USER}@${REMOTE_HOST} "cat > ${DEPLOY_DIR}/.env.production <<'ENVEOF'
DATABASE_URL=mysql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NEXTAUTH_URL=${NEXTAUTH_URL}
NODE_ENV=production
ENVEOF"
                        """
                    }
                }
            }
        }

        stage('Transfer Code') {
            steps {
                sshagent(credentials: ['PIXXEL_SSH_KEY']) {
                    sh """
                        rsync -az --delete \
                            --exclude='.git' \
                            --exclude='node_modules' \
                            --exclude='.next' \
                            --exclude='.env*' \
                            --exclude='infra' \
                            ./ ${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_DIR}/
                    """
                }
            }
        }

        stage('Build & Deploy') {
            steps {
                sshagent(credentials: ['PIXXEL_SSH_KEY']) {
                    sh """
                        ssh ${REMOTE_USER}@${REMOTE_HOST} "
                            cd ${DEPLOY_DIR}
                            docker compose -f docker-compose.prod.yml down --timeout 30 || true
                            docker compose -f docker-compose.prod.yml build --no-cache
                            docker compose -f docker-compose.prod.yml up -d
                        "
                    """
                }
            }
        }

        stage('Health Check') {
            steps {
                sshagent(credentials: ['PIXXEL_SSH_KEY']) {
                    sh """
                        ssh ${REMOTE_USER}@${REMOTE_HOST} 'bash -s' << 'REMOTE_SCRIPT'
                            attempt=0
                            until curl -sf http://localhost:${APP_PORT}/api/health > /dev/null 2>&1; do
                                attempt=\$((attempt+1))
                                if [ "\$attempt" -ge 18 ]; then
                                    echo 'Health check timed out after 90s'
                                    exit 1
                                fi
                                echo "Waiting for app... (\$attempt/18)"
                                sleep 5
                            done
                            echo 'App is healthy'
REMOTE_SCRIPT
                    """
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo "Deployed successfully to ${REMOTE_HOST}"
        }
        failure {
            echo "Deploy failed -- check logs above"
        }
    }
}
