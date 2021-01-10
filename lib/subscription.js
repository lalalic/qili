const { SubscriptionServer } =require('subscriptions-transport-ws')
const { execute, subscribe } =require( 'graphql')
const logger =require('./logger')

exports.extend=function(server, config){    
    SubscriptionServer.create({
        execute, subscribe,
        onConnect(initParams, socket, {request}){
            Object.assign(request.headers,initParams)
            
            return new Promise((resolve,reject)=>{
                require("./app").resolve(false)(request,{},()=>{
                    require('./user').graphql_auth()(request,{},()=>{
                        socket.app=request.app
                        socket.user=request.user
                        resolve()
                    })
                })
            })
        },
        onOperation(message, baseParams, socket){
            if(!socket.app)
                return new Error("no hack")
            
            return {
                ...baseParams,
                ...require('./app').graphql(socket.app,socket.user)
            }
        },
    },{
        server,
        path:`/${config.version}/graphql`
    })

    logger.log('subscription server ready')
}