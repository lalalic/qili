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