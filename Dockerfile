FROM registry.mirrors.aliyuncs.com/library/node:0.12

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
RUN git init
RUN git pull https://github.com/lalalic/qili.git

RUN npm install cnpm -g --registry=https://registry.npm.taobao.org

RUN cnpm install -g node-gyp jasmine

RUN cnpm install --production

#patch for mongodb driver issue with node.js https://github.com/mongodb/js-bson/issues/58
RUN cd node_modules/mongodb/node_modules/mongodb-core/ & rm -rf node_modules & cnpm install --production

RUN cnpm cache clear

EXPOSE 8080

VOLUME /usr/src/app

CMD git pull https://github.com/lalalic/qili.git & cnpm install --production & npm start
