cd ${TARGET_REPOSITORY_PATH}
git pull
cd deploy
docker-compose stop
docker-compose -f -v rm
${TARGET_DOCKER_ENVS} docker-compose up