const fs=require("fs"), readFile=fs.readFile
const cp = require('child_process'), spawn=cp.spawn, exec=cp.exec
const urllib=require("urllib"), request=urllib.request
const scheduler=require("node-schedule")
  
const Qiniu=require("qiniu")
const config=require("./conf")
Qiniu.conf.ACCESS_KEY=config.qiniu.ACCESS_KEY
Qiniu.conf.SECRET_KEY=config.qiniu.SECRET_KEY
const {conf:{API_HOST,RPC_TIMEOUT}, util}=Qiniu
  

async function syncCert(domain){
  const code = await renewCert(domain)
  if(code)
    return 
  const CertFile=`/data/certbot/live/${domain}/fullchain.pem`
  const PrivFile=`/data/certbot/live/${domain}/privkey.pem`
  const ca=await readMyFile(CertFile)
  const pri=await readMyFile(PrivFile)
  
  const url=`${API_HOST}/sslcert`
  return new Promise((resolve, reject)=>{
      request(url,{
        method:"POST",
        dataType:"json",
        contentType:"json",
        headers:{Authorization:util.generateAccessToken(url)},
        timeout:RPC_TIMEOUT,
        data:{name:domain, ca, pri}, 
      }, 
      (err, result, res)=>{
        if(!isError(err, result, res, reject)){
          updateCert(domain, result.certID).then(resolve, reject)
        }
      })
  })
}

function renewCert(domain){
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

function updateCert(domain, certId){
  console.log(`updating cdn.${domain} cert`)
  return new Promise((resolve, reject)=>{
    const url=`${API_HOST}/domain/cdn.${domain}/httpsconf`
    request(url,{
      headers:{Authorization:util.generateAccessToken(url)},
      timeout:RPC_TIMEOUT,
      contentType:"json",
      data:{certId},
    },(err,result, res)=>{
      if(!isError(err, result, res, reject)){
        removeExpiredCerts(domain)
        resolve()
      }
    })
  })
}

function removeExpiredCerts(domain){
  console.log("cleaning expired certs")
  const url=`${API_HOST}/sslcert`
  request(url,{
    headers:{Authorization:util.generateAccessToken(url)},
    dataType: 'json',
    timeout: RPC_TIMEOUT,
  },(err, result, res)=>{
    if(!isError(err, result, res, reject) && result && result.certs && result.certs.length){
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

function start(){
  console.log("starting qili....")
  return new Promise((resolve,reject)=>{
    exec("/root/qili.travis.deploy.sh",(error, stdout, stderr)=>{
      console.log(stdout)
      console.error(stderr)
      if(error){
        reject(error)
      }
    }).on('exit', resolve)
  })
}

async function schedule(){
  await start()
  const url=`${API_HOST}/sslcert`
  request(url,{
    headers:{Authorization:util.generateAccessToken(url)},
    dataType: 'json',
    timeout: RPC_TIMEOUT,
  },(err, result, res)=>{
    if(!isError(err, result, res, e=>e) && result && result.certs && result.certs.length){
      const now=Date.now()
      const validCerts=result.certs.filter(({not_after})=>not_after*1000>=now)
      const domains=validCerts.map(a=>a.name), not_before=Math.min(...validCerts.map(a=>a.not_before))*1000
      console.log('scheduling cert update for domains: '+domains.join(","))
      const j=scheduler.scheduleJob({start:new Date(not_before-5*24*60*60*1000), rule: '*/3 *'}, ()=>{
          Promise.all(domains.map(domain=>syncCert(domain)))
            .then(start)
      })
      if(j){
        console.log('next time on : '+j.nextInvocation())
      }else{
        console.error(`failed scheduling cert update`)
      }
    }
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