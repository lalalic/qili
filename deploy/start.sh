cd ${GIT_REPOSITORY}
git pull
cd deploy
${DOCKER_ENVS} docker-compose restart
