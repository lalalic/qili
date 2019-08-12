#!/bin/bash
docker run --rm -it -u root -v /data:/data alekzonder/puppeteer node /data/qili/deploy/qiniu-ssl.js $1 $2 $3