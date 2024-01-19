const { SubscriptionServer } =require('subscriptions-transport-ws')
const { execute, subscribe, parse } =require( 'graphql')
const logger =require('./logger')
const config = require('../conf')

const parseBuffer=message=>{
    let i=0, data=[]
    let length=message.readUInt32LE(0)
    const m=message.toString("utf-8",4,i=length+4)
    while(i<message.length && (length=message.readUInt32LE(i))){
        data.push(message.slice(i+4,i=length+i+4))
    }
    return JSON.parse(m,(k,v)=>{
        if(k && typeof(v)=="string"){
            const {groups:{j}={}}=v.match(/^__\$(?<j>\d+)$/)||{}
            if(j){
                return data[j-1]
            }
            return v
        }
        return v
    })
}

class MySubscriptionServer extends SubscriptionServer{
    onMessage(connectionContext){
        const _onMessage=super.onMessage(...arguments)
        return (message)=>{
            try{
                const isPublish=(Buffer.isBuffer(message) && parseBuffer(message)) 
                    || (message.indexOf(`"type":"publish"`)!=-1 && JSON.parse(message))
                if(isPublish){
                    const {payload,type}=isPublish
                    const {socket}=connectionContext
                    if(type=="publish"){
                        require('./app').resolveQuery({app:socket.app, body:payload})
                        const document=parse(payload.query)
                        const {root,context,schema,variables,operationName,customFormatErrorFn,extensions}={...require('./app').graphql(socket.app,socket.user),...payload}
                        execute(schema,document,root,context,variables,operationName)
                            .then(result=>{
                                extensions({
                                    document,
                                    variables,
                                    operationName,
                                    result,
                                    context
                                })
                            })
                            .catch(error=>{
                                error=customFormatErrorFn(error)
                                if(error){
                                    this.sendError(connectionContext,undefined,error)
                                }
                            })
                        return 
                    }
                }
            }catch(error){
                this.sendError(connectionContext,undefined,error)
                return 
            }
            return _onMessage(message)
        }
    }
}

exports.extend=function(server, path=`/${config.version}/websocket`){ 
    try{ 
        return config.subscribeServer=new MySubscriptionServer({
            execute, subscribe,
            onConnect(initParams, socket, {request}){
                Object.assign(request.headers,initParams)
                return new Promise((resolve,reject)=>{
                    const res={
                        status(code){
                            this.code=code
                            return this
                        },
                        end(){
                            const error=`subpub connection error: ${this.code}, ${!request.app && "No app"||""} ${!request.user && "Not Authoried User"||""}`
                            request.app?.logger.error(error)
                            socket.emit('error', error)
                            return this
                        }
                    }
                    require("./app").resolveApp(request,res,()=>{
                        require('./user').graphql_auth()(request,res,()=>{
                            const {app, user}=request
                            const context={app:socket.app=app, user:socket.user=user, request:initParams.request}
                            app.cloud.pubsub?.onConnect?.(context)
                            resolve(context)
                        })
                    })
                })
            },
            onDisconnect(socket, context){
                context.initPromise.then(({app,user, request})=>{
                    if(app){
                        app.cloud.pubsub?.onDisconnect?.({app,user,request})
                    }
                })
            },
            onOperation({payload}, baseParams, socket){
                const body={...payload}
                require('./app').resolveQuery({app:socket.app,body})
                return {
                    ...body,
                    ...require('./app').graphql(socket.app,socket.user),
                }
            },
        },{
            path,
            server,
        })
    }finally{
        logger.info(`subscription server ready at ${path}`)
    }
}