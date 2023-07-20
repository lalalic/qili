require("dotenv").config()

module.exports=function dev({clientPort,serverPort, conf, apiKey, dbpath="testdata", vhost, credentials}={}){
    console.assert(!!conf && !!apiKey)
    const qiliConfig=require("./conf")

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
    
    require('child_process')
        .spawn(
            "mongod",
            ["--storageEngine=wiredTiger", "--directoryperdb", `--dbpath=${dbpath}`],
            {stdio:['ignore','ignore','inherit'], killSignal:'SIGINT'}
        )

    console.debug(qiliConfig)
    const server=require("./lib")

    if(vhost){
        let notifyNoSubput=false
        console.warn('vhost is enabled. use> sudo yarn ')
        const express=require('express')
        const vhostMiddleware=require('vhost')
        const hosts=new (require('hosts-so-easy').default)();
        const vApp=express()
        vApp.use(vhostMiddleware(`*.${vhost}`,function(req, res){
            const ctx=req.vhost[0]
            switch(ctx){
                case apiKey:
                    req.url=`/${qiliConfig.version}/${apiKey}/static${req.url}`
                    break
                case "proxy":
                    req.url=`/${qiliConfig.version}${apiKey}/proxy${req.url}`
                    break
                case "api":{
                    if(req.headers.upgrade=="websocket"){
                        if(!notifyNoSubput){
                            console.error(`vhost can't support subscription, skip`)
                            notifyNoSubput=true
                        }
                        res.status(401).end()
                        return 
                    }
                    req.url=`/${qiliConfig.version}/graphql`
                    req.headers['x-application-id']=apiKey
                    break
                }
            }
            server(...arguments)
        }))

        const all=[`api.${vhost}`, `${apiKey}.${vhost}`, `proxy.${vhost}`]
        const removeLocalhosts=()=>{
            require('fs').writeFileSync(hosts.config.hostsFile, hosts.hostsFile.raw,{encoding:"utf8"})
            console.log('hosts is recovered')
        }
        hosts.add('127.0.0.1',all)
        hosts.updateFinish()
            .then(()=>{
                const http=require('http')
                const https = require('https');
                const httpServer=http.createServer({},vApp)
                httpServer.listen(80)
                if(credentials){
                    const httpsServer = https.createServer(credentials, vApp);
                    httpsServer.listen(443)
                }
            })
            .then(()=>{
                console.log('vhost is ready in hosts. hosts will be clear once exit')
                process.on('exit',removeLocalhosts)
                process.on('SIGINT',removeLocalhosts)
                process.on('SIGTERM',removeLocalhosts)
                console.debug(`Qili Dev Server is on localhost -> https://[${apiKey}|api|proxy].${vhost}`)
            })
            .catch(e=>console.error(e.message))
    }else{
        console.debug(`Qili Dev Server is on localhost:${qiliConfig.server.port}`)
    }
}