exports.extend=(app,config)=>{
	app.use('/:appKey/static', (req, res, next)=>{
		req.headers['x-application-id']=req.params.appKey
		require('./app').resolve()(req, res, (error)=>{//resolve app
			if(error){
				next(error)
			}else{
				req.app 
				&& req.app.cloud 
				&& req.app.cloud.static 
				&& req.app.cloud.static.reply(req,res)
			}
		})
	})
}

exports.create=()=>{
	const statics=[]
	return Object.create({
		on(path, callback){
			statics.push({path,callback})
			return this
		},
		
		reply(req,  res){
			const path=req.path
			const cloudRes={
				reply(html){
					res.send(html)
				}
			}
			
			let matched=statics.find(({path:pattern})=>pattern.test(path))
			if(matched){
				const cloudReq={
					path,
					app:req.app
				}
				try{
					matched.callback(cloudReq, cloudRes)
				}catch(error){
					cloudRes.reply(error)
				}
			}else{
				cloudRes.reply("no static content")
			}
		}
	})
}