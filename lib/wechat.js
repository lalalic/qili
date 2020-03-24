const wechat=require("wechat")
const logger=require("./logger")
exports.extend=(app,config)=>{
	app.use('/:appKey/wechat', (req, res, next)=>{
		req.headers['x-application-id']=req.params.appKey
		require('./app').resolve()(req, res, (error)=>{//resolve app
			if(error){
				logger.error(error)
				next(error)
			}else{
				wechat(config.wechat.token, (req, res, next)=>{
					req.app 
					&& req.app.cloud 
					&& req.app.cloud.wechat 
					&& req.app.cloud.wechat.reply(req,res)
				})(req, res, next)
			}
		})
	})
	logger.info(`App[${app.name}] wechat service installed`)
}

exports.create=()=>{
	const service={}
	return Object.create({
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
		},
		
		reply(req, res){
			const type=req.weixin.MsgType
			const message=Object.assign({},req.weixin,{
				ToUserName:undefined,
				FromUserName:undefined,
				CreateTime:undefined,
				MsgId:undefined
			})
			
			const cloudReq={
				message, 
				app:req.app
			}
			
			const cloudRes={
				send(a){
					res.reply(a)
				}
			}
			if(service.all){
				service.all(cloudReq,cloudRes)
			}else{
				(service[type]||function(){})(cloudReq,cloudRes)
			}
		}
	})
}