var wechat=require("wechat");

class Main extends require('./service'){
    constructor(req, res){
        super(req, res)
        this.response=res
    }
    reply(message, next){
        var cloud=this.getCloudCode(),
            res=this.response;
        this.cloudReq.params=message
        this.cloudReq.wechat=wechat
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
}

Object.assign(module.exports=Main,{
    resolve(){
        var server=require("../server"),
            app=server.app,
            cfg=server.config;

        app.use('/:appKey/wechat', function(req, res, next){
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

    init(){
        var server=require("../server"),
            app=server.app,
            cfg=server.config;

        app.use('/:appKey/wechat', (req, res, next)=>{
            (new this(req, res)).reply(req.weixin,next)
        })
    }
})
