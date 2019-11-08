exports.apollo=function apollo(server,config){
    const { SubscriptionServer } =require('subscriptions-transport-ws')
    const { execute, subscribe } =require( 'graphql')

    SubscriptionServer.create({
        execute(){
            debugger
            return execute(...arguments)
        },
        subscribe(){
            debugger
            return subscribe(...arguments)
        },
        onConnect(initParams, socket, {request}){
            Object.assign(request.headers,initParams)
            //resolve app, and user
            return new Promise((resolve,reject)=>{
                require("./app").resolve(false)(request,{},()=>{
                    require('./user').graphql_auth()(request,{},()=>{
                        socket.app=request.app
                        socket.user=request.user
                        resolve()
                    })
                    socket.close()
                })
                socket.close()
            })
            
        },
        onOperation(message, baseParams, socket){
            debugger
            //return app's schema
            if(socket.app){
                return {
                    ...baseParams,
                    ...require('./app').graphql(socket.app,socket.user)
                }
            }
            return new Error("no hack")
        }
    },{
        server,
        path:"/1/graphql"
    })
}