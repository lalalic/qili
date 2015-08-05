FROM registry.mirrors.aliyuncs.com/library/node:0.12-onbuild

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

#patch for mongodb driver issue with node.js https://github.com/mongodb/js-bson/issues/58
RUN npm install -g node-gyp
#RUN cd node_modules/mongodb/node_modules/mongodb-core/ & rm -rf node_modules & npm install

EXPOSE 8080

VOLUME /usr/src/app

CMD ["npm", "start"]
