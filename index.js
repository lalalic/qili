const fs=require("fs"), readFile=fs.readFile
const cp = require('child_process'), spawn=cp.spawn, exec=cp.exec
const urllib=require("urllib"), request=urllib.request
const querystring = require('querystring');

  
const Qiniu=require("qiniu")
const config=require("./conf")
Qiniu.conf.ACCESS_KEY=config.qiniu.ACCESS_KEY
Qiniu.conf.SECRET_KEY=config.qiniu.SECRET_KEY
const {conf:{API_HOST,RPC_TIMEOUT},rpc, util}=Qiniu

module.exports.sync=async function syncCert(domain){
  const failedRenewCert = await renewCert(domain)
  if(failedRenewCert)
    return 
  
  const CertFile=`/data/certbot/live/${domain}/fullchain.pem`
  const PrivFile=`/data/certbot/live/${domain}/privkey.pem`
  const ca=await readMyFile(CertFile)
  const pri=await readMyFile(PrivFile)
  
  const url=`${API_HOST}/sslcert`, content=querystring.stringify({name:domain, ca, pri})
  console.log(`uploading cert for ${domain}`)
  return new Promise((resolve, reject)=>{
      rpc.postWithForm(url,content,util.generateAccessToken(url,content), 
      (err, result, res)=>{
        if(!isError(err, result, res, reject)){
          updateCdnCert(domain, result.certID).then(resolve, reject)
        }
      })
  })
}

function renewCert(domain){
  console.log(`renewing certifiction for ${domain}`)
  return new Promise((resolve, reject)=>{
    exec(`/data/qili/deploy/cert/cert-renew.sh ${domain}`,{
        cwd:`${__dirname}/deploy/cert`,
      },(error, stdout, stderr)=>{
      console.log(stdout)
      console.error(stderr)
      if(error){
        reject(error)
      }
    }).on('exit',resolve)
  })
}

function updateCdnCert(domain, certId){
  console.log(`updating cdn.${domain} cert`)
  return new Promise((resolve, reject)=>{
    const url=`${API_HOST}/domain/cdn.${domain}/httpsconf`, content=querystring.stringify({certId})
    request(url,{
      method:"PUT",
      dataType: 'json',
      timeout: RPC_TIMEOUT,
      headers:{
        Authorization:util.generateAccessToken(url,content),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      content,
    },
    (err,result, res)=>{
      if(!isError(err, result, res, reject)){
        removeExpiredCerts(domain)
        resolve()
      }
    })
  })
}

function removeExpiredCerts(domain){
  console.log(`cleaning expired certs for ${domain}`)
  const url=`${API_HOST}/sslcert`
  request(url,{
    headers:{Authorization:util.generateAccessToken(url)},
    dataType: 'json',
    timeout: RPC_TIMEOUT,
  },(err, result, res)=>{
    if(!isError(err, result, res, console.error) && result && result.certs && result.certs.length){
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
    readFile(path, "ascii", (error, data)=>{
      error ? reject(error) : resolve(data)
    })
  })
}

function isError(err, result, res, reject){
  let rerr = null;
  if (err || Math.floor(res.statusCode/100) !== 2) {
    rerr = {code: res&&res.statusCode||-1, error: err||result&&result.error||''};
  }
  if(rerr){
    console.error(rerr)
    reject(rerr)
    return true
  }
}