FROM registry.mirrors.aliyuncs.com/library/node:0.12

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
RUN git init
RUN git pull https://github.com/lalalic/qili.git
COPY conf.product.js ./conf.js

RUN npm install cnpm -g --registry=https://registry.npm.taobao.org

RUN cnpm install -g node-gyp jasmine pm2

RUN cnpm install --production

RUN cnpm install request

#patch for mongodb driver issue with node.js https://github.com/mongodb/js-bson/issues/58
RUN cd node_modules/mongodb/node_modules/mongodb-core/ & rm -rf node_modules & cnpm install --production

RUN cnpm cache clear

EXPOSE 9080

VOLUME /usr/src/app

CMD mv conf.js conf.js.bak && \
    git checkout conf.js && \
    git pull https://github.com/lalalic/qili.git && \
    mv conf.js.bak conf.js && \
    cnpm install --production && \
    npm start
