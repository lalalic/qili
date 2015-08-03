var wechat=require("wechat"),
    Super=require('./service'),
    _=require('underscore');

module.exports=Super.extend({
    constructor:function(req, res){
        Super.call(this,arguments)
        this.response=res
    },
    reply: function(message, next){
        var cloud=this.getCloudCode(),
            res=this.response;
        this.cloudReq.params=message
        this.cloudReq.wechat=wechat
        cloud.run('wechat',this.cloudReq, {
            success:function(o){
                res.send(_.extend({
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
},{
    resolve: function(){
        var server=require("../server"),
            app=server.app,
            cfg=server.config;

        app.use('/'+this.version+'/:appKey/wechat', function(req, res, next){
            req.headers['X-Application-Id']=req.params.appKey
            require('./app').resolve(true)(req, res, function(error){//resolve app
                if(error){
                    next(error)
                }else{
                    wechat(req.application.token,function(req, res, next){//resolve weixin
                        req.headers['X-Session-Token']=req.weixin.FromUserName
                        require('./user').resolve(true)(req, res, function(error){
                            if(error){
                                next(error)
                            }else{
                                next('route')
                            }
                        })
                    })(req, res, next)
                }
            });


        });

        return function(req, res, next){
            next()
        }
    },

    init:function(){
        var server=require("../server"),
            app=server.app,
            cfg=server.config;

        app.use('/'+this.version+'/:appKey/wechat', function(req, res, next){
            var service=new this(req, res)
            service.reply(req.weixin,next)
        }.bind(this))
    }
})
