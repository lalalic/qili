cd /data/certbot

git clone https://github.com/tengattack/certbot-dns-aliyun

cd certbot-dns-aliyun

docker build . -t certbot/dns-aliyun

rm -rf /data/certbot/certbot-dns-aliyun