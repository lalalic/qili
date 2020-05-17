const {readFile}=require("fs")
const { spawn, exec } = require('child_process');
const {request}=require("urllib")
const querystring = require('querystring')
const scheduler=require("node-schedule")
  
const Qiniu=require("qiniu")
const config=require("./conf")
Qiniu.conf.ACCESS_KEY=config.qiniu.ACCESS_KEY
Qiniu.conf.SECRET_KEY=config.qiniu.SECRET_KEY


export async function syncCert(domain){
  const code = await renewCert(domain)
  
  const CertFile=`/data/certbot/live/${domain}/fullchain.pem`
  const PrivFile=`/data/certbot/live/${domain}/privkey.pem`
  const ca=await readMyFile(CertFile)
  const pri=await readMyFile(PrivFile)
  
  const {conf:{API_HOST}, util, rpc}=Qiniu
  const url=`${API_HOST}/sslcert`
  return new Promise((resolve, reject)=>{
    rpc.post(url, util.generateAccessToken(url), 
      querystring.stringify({ca, pri}), 
      (err, result, res)=>{
        if(!isError(err, res, reject)){
          updateCert(domain, result.certID).then(resolve, reject)
        }
      })
  })
}

function renewCert(domain){
  return new Promise((resolve, reject)=>{
    const docker = spawn('docker', [
      'run','--rm', 
      '-v /data/certbot:/etc/letsencrypt', 
      'certbot/dns-aliyun',
      'certonly',
      `--cert-name=${domain}`, 
      `-d ${domain},*.${domain}`, 
      `-a`, `certbot-dns-aliyun:dns-aliyun`,  
      `--certbot-dns-aliyun:dns-aliyun-credentials /etc/letsencrypt/ali.ini`
    ]);
    docker.stdout.on('data',d=>console.log(d))
    docker.stderr.on('data',d=>console.error(d))
    docker.on('exit',code=>{
      resolve(code)
    })
  })
}

function updateCert(domain, certId){
  return new Promise((resolve, reject)=>{
    const {conf:{API_HOST,RPC_TIMEOUT}, util}=Qiniu
    const url=`${API_HOST}/domain/cdn.${domain}/httpsconf`
    request(url,{
      headers:{Authorization:util.generateAccessToken(url)},
      timeout:RPC_TIMEOUT,
      content:querystring.stringify({certId})
    },(err,result, res)=>{
      if(!isError(err, res, reject)){
        removeExpiredCerts(domain)
        resolve()
      }
    })
  })
}

function removeExpiredCerts(domain){
  const {conf:{API_HOST,RPC_TIMEOUT}, util}=Qiniu
  const url=`${API_HOST}/sslcert`
  request(url,{
    headers:{Authorization:util.generateAccessToken(url)},
    dataType: 'json',
    timeout: RPC_TIMEOUT,
  },(err, result, res)=>{
    if(!isError(err, res, reject) && result && result.certs && result.certs.length){
      const now=Date.now(), certs=result.certs
      certs.forEach(({not_after,certid, name})=>{
        if(not_after<now && name===domain){
          const url=`${API_HOST}/sslcert/${certid}`
          request(url,{
            headers:{Authorization:util.generateAccessToken(url)},
            method:"DELETE"
          })
        }
      })
    }
  })
}


function readMyFile(path){
  return new Promise((resolve, reject)=>{
    readFile(path, (error, data)=>{
      error ? reject(error) : resolve(data)
    })
  })
}

function start(){
  return new Promise((resolve,reject)=>{
    exec("/root/qili.travis.deploy.sh",(error, stdout, stderr)=>{
      console.log(stdout)
      console.error(stderr)
      if(error){
        reject(error)
      }else{
        resolve()
      }
    })
  })
}

export function schedule(){
  await start()
  const {conf:{API_HOST,RPC_TIMEOUT}, util}=Qiniu
  const url=`${API_HOST}/sslcert`
  request(url,{
    headers:{Authorization:util.generateAccessToken(url)},
    dataType: 'json',
    timeout: RPC_TIMEOUT,
  },(err, result, res)=>{
    if(!isError(err, res, reject) && result && result.certs && result.certs.length){
      const now=Date.now()
      const validCerts=result.certs.filter(({not_after})=>not_after>=now)
      const domains=validCerts.map(a=>a.name), not_before=Math.min(...validCerts.map(a=>a.not_before))
      const t=not_before-5*24*60*60*1000
      scheduler.scheduleJob({start:new Date(t), rule: '/3 *'}, ()=>{
          Promise.all(domains.map(name=>sync(name)))
            .then(a=>start)
      })
    }
  })
}

function isError(err, res, reject){
  let rerr = null;
  if (err || Math.floor(res.statusCode/100) !== 2) {
    rerr = {code: res&&res.statusCode||-1, error: err||result&&result.error||''};
  }
  if(rerr){
    reject(rerr)
    return true
  }
}
