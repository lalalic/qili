module.exports=function dev({clientPort=9081,serverPort=parseInt(`1${clientPort}`), cloudCodeFile, appId, dbpath="testdata", www, }={}){
    this.server.port=serverPort
    console.debug(`Qili Dev Server is on localhost:${serverPort}`)
    this.www=require("express-http-proxy")(`localhost:${clientPort}`,{
        filter(req,res){
            if(req.url=="/app.apk.version"){
                res.send('1.0.x')
                return false
            }
            console.debug(`redirecting to ${req.url}`)
            return true
        }
    })
    
    if(cloudCodeFile){
        this.cloud[appId]={
            root:www,
            ...this.cloud[appId],
            code:cloudCodeFile,
        }
    }
    
    require('node:child_process').spawn("mongod",["--storageEngine=wiredTiger", "--directoryperdb", `--dbpath=${dbpath}`],{stdio:'inherit'})

    require("./lib")
    require('node:child_process').exec(`open http://localhost:${serverPort}`)	
}