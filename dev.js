module.exports=function dev({clientPort,serverPort, conf, apiKey, dbpath="testdata"}={}){
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
    
    require('node:child_process')
        .spawn(
            "mongod",
            ["--storageEngine=wiredTiger", "--directoryperdb", `--dbpath=${dbpath}`],
            {stdio:['ignore','ignore','inherit'], killSignal:'SIGINT'}
        )

    require("./lib")
    console.debug(`Qili Dev Server is on localhost:${qiliConfig.server.port}`)
}