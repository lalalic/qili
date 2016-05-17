FROM "${IMAGE_ROOT}node:4"

WORKDIR /data/qili
RUN git init
RUN git pull https://github.com/lalalic/qili.git

RUN npm install cnpm -g --registry=https://registry.npm.taobao.org

RUN cnpm install -g node-gyp

RUN cnpm install --production

RUN cnpm install request

#patch for mongodb driver issue with node.js https://github.com/mongodb/js-bson/issues/58
RUN cd node_modules/mongodb/node_modules/mongodb-core/ & rm -rf node_modules & cnpm install --production

RUN cnpm cache clear

EXPOSE 9080
EXPOSE 9443

CMD exec > /data/log/qili.log && \
    git pull https://github.com/lalalic/qili.git && \
    cnpm install --production && \
    npm start
