FROM node:8-alpine

WORKDIR /data/qili

RUN yarn install --production

EXPOSE 9080
EXPOSE 9443

CMD exec > /data/log/qili.log 2>&1 && \
    yarn install --production && \
    yarn start
