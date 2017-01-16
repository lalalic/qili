"use strict"
var wechat=require("wechat");

class WeChatService extends require('./service'){
    constructor(req, res){
        super(req, res)

        this.cloudRes.success=(a)=>res.reply(a)
        this.cloudRes.error=(a)=>res.reply()

        this.cloudReq.message=Object.assign({},req.weixin,{
            ToUserName:undefined,
            FromUserName:undefined,
            CreateTime:undefined,
            MsgId:undefined
        });
        this.type=req.weixin.MsgType
    }

    reply(){
        let code=this.getCloudCode()
        let cloud=code.asWechat()
        let next=()=>{(cloud[this.type]||function(){})(this.cloudReq, this.cloudRes)};
        if(cloud.all){
            cloud.all(this.cloudReq, this.cloudRes, next)
        }else{
            next()
        }
    }

    /**
    {
        all: (req:{message,session}, res:{success(),error()}, next),
        event:(req:{message,session}, res:{success(),error()}),
        text, image, voice, video, location, device_event, device_text
    }
    */
    static asCloud(service){
        return {
            on(event, callback){
                switch(typeof(event)){
                case 'function':
                    service.all=event
                    break
                case 'string':
                    service[event]=callback
                    break
                }
                return this
            }
        }
    }

    static resolve(app, cfg){
        app.use('/:appKey/wechat', function(req, res, next){
            req.headers['X-Application-Id']=req.params.appKey
            require('./app').resolve(true)(req, res, (error)=>{//resolve app
                if(error){
                    next(error)
                }else{
                    wechat(cfg.wechat.token,(req, res, next)=>{//resolve weixin
                        new WeChatService(req, res).reply()
                    })(req, res, next)
                }
            })
        })

        return function(req, res, next){
            next()
        }
    }
}

module.exports=WeChatService
