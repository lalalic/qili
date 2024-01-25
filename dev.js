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

    qiliConfig.cloud[apiKey]={...conf}
    Object.assign(qiliConfig.cloud, services)

    require('fs').mkdirSync(require('path').resolve(process.cwd(),dbpath),{recursive:true})
    
    require('child_process')
        .spawn(
            "mongod",
            ["--storageEngine=wiredTiger", "--directoryperdb", `--dbpath=${dbpath}`],
            {stdio:['ignore','ignore','ignore'], killSignal:'SIGINT'}
        )

    // require('child_process')
    //     .spawn(
    //         "redis-stack-server",
    //         [],
    //         {stdio:['inherit','inherit','inherit'], killSignal:'SIGINT'}
    //     )
    
    // const postgres=require('path').resolve(process.cwd(),`${dbpath}/postgres`)
    // require('fs').mkdirSync(postgres,{recursive:true})
    // require('child_process')
    //     .spawn(
    //         "/Library/PostgreSQL/16/bin/pg_ctl",
    //         ["-D", postgres, "start"],
    //         {stdio:['inherit','inherit','inherit'], killSignal:'SIGINT'}
    //     )

    if(vhost){
        qiliConfig.cloud[apiKey].vhost=vhost
        Object.keys(services).forEach(key=>{
            qiliConfig.cloud[key].vhost=qiliConfig.cloud[key].vhost||vhost
        })
    }
    console.debug(qiliConfig)
    const server=require("./lib")

    if(!vhost){
        console.debug(`Qili Dev Server is on localhost:${qiliConfig.server.port}`)
        return 
    }

    console.warn('vhost is enabled. use> sudo yarn ')
    const express=require('express')
    const vhostMiddleware=require('vhost')
    const hosts=new (require('hosts-so-easy').default)();
    const vApp= express()
    vApp.use(vhostMiddleware(`*.${vhost}`,function(req, res, next){
        const ctx=req.vhost[0]
        function handle(apiKey){
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
                case `${apiKey}api`:
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
                    }else{
                        return handle(ctx)
                    }
                }
            }
            server(req, res, next)
        }

        handle(apiKey)
    }))

    const all=[`api`, `${apiKey}api`, apiKey, `proxy`, alias, ...Object.keys(services)].filter(a=>!!a)
    const removeLocalhosts=(servers)=>{
        servers?.forEach(server=>server.close())
        require('fs').writeFileSync(hosts.config.hostsFile, hosts.hostsFile.raw,{encoding:"utf8"})
        console.log('hosts is recovered')
    }
    hosts.add('127.0.0.1',[...all.map(a=>`${a}.${vhost}`), 'qili.pubsub'])

    hosts.updateFinish()
        .then(()=>{
            const servers=[]
            const http=(servers[0]=require('http').createServer({},vApp)).listen(80)
            require("./lib/web-socket").extend(http)
            if(credentials){
                const https=(servers[1]=require('https').createServer(credentials, vApp)).listen(443)
                require("./lib/web-socket").extend(https)
            }
            servers.push(server.httpServer)
            return servers
        })
        .then((servers)=>{
            console.log('vhost is ready in hosts. hosts will be clear once exit')
            process.on('exit',()=>removeLocalhosts(servers))
            process.on('SIGINT',()=>removeLocalhosts(servers))
            process.on('SIGTERM',()=>removeLocalhosts(servers))
            console.debug(`Qili Dev Server is on localhost -> https://[${all.join("|")}].${vhost}`)
        })
        .catch(e=>console.error(e.message))
}