FROM node:8-alpine

WORKDIR /data/qili

RUN npm install --production

RUN npm cache clear

EXPOSE 9080
EXPOSE 9443

CMD exec > /data/log/qili.log && \
    npm install --production && \
    npm start
