"use strict"

const staticPath='/static/'
class StaticService extends require('./service'){
    constructor(req, res){
        super(req, res)

        this.cloudRes.success=html=>{
			res.type('html')
			res.send(html)
		}
        this.cloudRes.error=a=>{
			res.status(404)
			res.send("error")
		}
		delete this.cloudReq.user
    }

    reply(path){
        let code=this.getCloudCode()
        let statics=code.asStatic()
		let matched=statics.find(({path:pattern})=>pattern.test(path))
		if(matched){
			this.cloudReq.path=path
			try{
				matched.callback(this.cloudReq, this.cloudRes)
			}catch(error){
				this.cloudRes.error(error)
			}
		}else{
			this.cloudRes.success("no static content")
		}
    }

    static asCloud(service){
        return {
            on(path, callback){
                switch(typeof(path)){
                case 'string':
                    service.push({path:new RegExp(path), callback})
                    break
				default:
					service.push({path,callback})
                }
                return this
            }
        }
    }

    static resolve(app){
        app.use('/:appKey/static', function(req, res, next){
            req.headers['X-Application-Id']=req.params.appKey
            require('./app').resolve(true)(req, res, (error)=>{//resolve app
                if(error){
                    next(error)
                }else{
                    new StaticService(req, res)
						.reply(req.path)
                }
            })
        })

        return function(req, res, next){
            next()
        }
    }
}
 
module.exports=StaticService
