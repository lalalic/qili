cd ${TARGET_REPOSITORY_PATH}
git pull
cd deploy
${TARGET_DOCKER_ENVS} docker-compose ${TARGET_DOCKER_ACTIOIN}
echo "deploy done on server"
