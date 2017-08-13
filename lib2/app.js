const config=require("../conf")
const {Passwordless} = require('passwordless');
const MongoStore = require('passwordless-mongostore');

export default class App{
    constructor(req, res){

    }

    buildSchema(){

    }
    
    getMongoServer(){
        return new mongo.Server(config.db.host, config.db.port, {'auto_reconnect':true,safe:true})
    }

    get passwordless(){
        if(this._passworless)
            return this._passworless

        this._passwordless=new Passwordless()
        passwordless.init(new MongoStore(`mongodb://${config.db.host}:${config.db.port}/${req.app._id}`))
        passwordless.addDelivery("sms", (tokenToSend, uidToSend, recipient, callback, req)=>{
            console.log(`http://${config.server.host}:${config.server.port}/?by=sms&token=${tokenToSend}&uid=${encodeURIComponent(uidToSend)}`)
            callback()
        })

        passwordless.addDelivery("email",(tokenToSend, uidToSend, recipient, callback, req)=>{
            console.log(`http://${config.server.host}:${config.server.port}/?by=email&token=${tokenToSend}&uid=${encodeURIComponent(uidToSend)}`)
            callback()
        })
    }
}
