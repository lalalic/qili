FROM node:18-alpine

WORKDIR /data/qili

RUN yarn install --production
RUN yarn global add patch-package

EXPOSE 9080
EXPOSE 9443

CMD yarn install --production && \
    yarn start