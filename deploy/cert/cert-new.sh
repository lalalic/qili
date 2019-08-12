#!/bin/bash
./cert.sh certonly  --cert-name=$1 -d $1,*.$1 -a certbot-dns-aliyun:dns-aliyun  --certbot-dns-aliyun:dns-aliyun-credentials /etc/letsencrypt/ali.ini