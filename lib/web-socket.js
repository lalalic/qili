const {Server}=require('socket.io')
const logger =require('./logger')
const config = require('../conf')

exports.extend=function(server){
    server.on('upgrade',function(request, socket, head){
        const params=new URL(`http://a.com${request.url}`).searchParams
        if(params.has('x-application-id')){
            request.headers['x-application-id']=params.get('x-application-id')
        }
        if(params.has('x-session-token')){
            request.headers['x-session-token']=params.get('x-session-token')
        }

        return new Promise((resolve, reject)=>{
            const response={
                status(code){
                    this.code=code
                    return this
                },
                end(){
                    const error=`subpub connection error: ${this.code}, ${!request.app && "No app"||""} ${!request.user && "Not Authoried User"||""}`
                    request.app?.logger.error(error)
                    socket.emit('error', error)
                    reject()
                    return this
                }
            }
            require("./app").resolveApp(request,response,()=>{
                require('./user').web_auth()(request,response, resolve)
            })
        })
    })

    const path=`/${config.version}/websocket`
    require("./subscription").extend(server, path)

    try{
        return config.websocketServer=new Server(server,{
            path:`${path}/socket.io`,
	        cors:{origin:'*'},
        })
    }finally{
        logger.info(`websocket server ready at ${path}/socket.io`)
    }
}
