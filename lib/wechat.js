"use strict"
var wechat=require("wechat");

class Main extends require('./service'){
    constructor(req, res){
        super(req, res)
        this.response=res
    }
    reply(session, message, next){
        var cloud=this.getCloudCode(),
            res=this.response;
        this.cloudReq.params=message
        this.cloudReq.wechat=session

        cloud.define('wechat', (req, res)=>{
            res.success({content:"good"})
        })

        cloud.run('wechat',this.cloudReq, {
            success:function(o){
                res.send(Object.assign({
                    ToUserName:message.FromUserName,
                    FromUserName:message.ToUserName,
                    CreatedTime:Date.now()
                },o))
            },
            error: function(error){
                next(error)
            }
        })
    }

    onSubscribe(){
        var openID=this.message.FromUserName
        /**
            get user information, to create a new user

        */
    }



    static resolve(app, cfg){
        app.use('/:appKey/wechat', function(req, res, next){
            req.headers['X-Application-Id']=req.params.appKey
            require('./app').resolve(true)(req, res, (error)=>{//resolve app
                if(error){
                    next(error)
                }else{
                    wechat(cfg.token,(req, res, next)=>{//resolve weixin
                        res.reply({type:"text", content:req.weixin.Content})
                        /*
                        req.headers['X-Session-Token']=req.weixin.FromUserName
                        require('./user').resolve(true)(req, res, (error)=>{
                            if(error){
                                console.dir(error)
                                next(error)
                            }else{
                                console.dir(req.user)
                                (new this(req, res)).reply(req.weixin)
                            }
                        })*/
                    })(req, res, next)
                }
            });


        });

        return function(req, res, next){
            next()
        }
    }
}

module.exports=Main
