process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

require("dotenv").config()

module.exports=function dev({clientPort,serverPort, conf, apiKey, dbpath="testdata", vhost, alias, credentials, services={}}={}){
    console.assert(!!conf && !!apiKey)
    const qiliConfig=require("./conf")
    qiliConfig.server.timeout=100000000
    qiliConfig.applyConfFromEnv(apiKey,conf)
    Object.entries(services).forEach(([serviceApiKey,serviceConf])=>qiliConfig.applyConfFromEnv(serviceApiKey,serviceConf))
    
console.log(process.env)
    if(serverPort){
        qiliConfig.server.port=serverPort
    }

    if(clientPort){
        qiliConfig.www=require("express-http-proxy")(`localhost:${clientPort}`,{
            filter(req,res){
                if(req.url=="/app.apk.version"){
                    res.send('1.0.x')
                    return false
                }
                console.debug(`redirecting to ${req.url}`)
                return true
            }
        })
    }

    qiliConfig.cloud[apiKey]=conf
    Object.assign(qiliConfig.cloud, services)

    require('fs').mkdirSync(require('path').resolve(process.cwd(),dbpath),{recursive:true})
    
    require('child_process')
        .spawn(
            "mongod",
            ["--storageEngine=wiredTiger", "--directoryperdb", `--dbpath=${dbpath}`],
            {stdio:['ignore','ignore','inherit'], killSignal:'SIGINT'}
        )
    
    
    console.debug(qiliConfig)
    const server=require("./lib")

    if(vhost){
        console.warn('vhost is enabled. use> sudo yarn ')
        const express=require('express')
        const vhostMiddleware=require('vhost')
        const hosts=new (require('hosts-so-easy').default)();
        const vApp=express()
        vApp.use(vhostMiddleware(`*.${vhost}`,function(req, res){
            const ctx=req.vhost[0]
            switch(ctx){
                case alias:
                case apiKey:
                    if(req.path!=="/graphql"){
                        req.url=`/${qiliConfig.version}/${apiKey}/static${req.url}`
                    }else if(conf.graphiql){
                        req.url=`/${qiliConfig.version}${req.url}`
                        if(!req.headers['x-application-id']){
                            req.headers['x-application-id']=apiKey
                        }
                        const {QILI_TOKEN:token=""}=process.env
                        if(token.length==0){
                            console.warn(`graphiql need, but can't find token from env.QILI_TOKEN`)
                        }else{
                            req.headers[token.length>100 ? 'x-session-token' : "x-access-token"]=token
                        }
                    }
                    break
                case "api":{
                    req.url=`/${qiliConfig.version}/graphql`
                    if(!req.headers['x-application-id']){
                        req.headers['x-application-id']=apiKey
                    }
                    break
                }
                default:{
                    if(!services[ctx]){
                        break
                    }
                    req.url=`/${qiliConfig.version}/${ctx}/static${req.url}`
                }
            }
            server(...arguments)
        }))

        const all=[`api`, apiKey, `proxy`, alias, ...Object.keys(services)]
        const removeLocalhosts=()=>{
            require('fs').writeFileSync(hosts.config.hostsFile, hosts.hostsFile.raw,{encoding:"utf8"})
            console.log('hosts is recovered')
        }
        hosts.add('127.0.0.1',all.map(a=>`${a}.${vhost}`))
        hosts.updateFinish()
            .then(()=>{
                const http=require('http')
                const https = require('https');
                const httpServer=http.createServer({},vApp)
                httpServer.listen(80)
                require("./lib/subscription").extend({server:httpServer,qiliConfig, path:`/${qiliConfig.version}/graphql`})
                if(credentials){
                    const httpsServer = https.createServer(credentials, vApp);
                    httpsServer.listen(443)
                    require("./lib/subscription").extend({server:httpsServer,qiliConfig, path:`/${qiliConfig.version}/graphql`})
                }
            })
            .then(()=>{
                console.log('vhost is ready in hosts. hosts will be clear once exit')
                process.on('exit',removeLocalhosts)
                process.on('SIGINT',removeLocalhosts)
                process.on('SIGTERM',removeLocalhosts)
                console.debug(`Qili Dev Server is on localhost -> https://[${all.join("|")}].${vhost}`)
            })
            .catch(e=>console.error(e.message))
    }else{
        console.debug(`Qili Dev Server is on localhost:${qiliConfig.server.port}`)
    }
}