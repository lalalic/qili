exports.create=()=>{
	const statics=[]
	return Object.create({
		on(path, callback){
			statics.push({path,callback})
			return this
		},
		
		reply(req,  res, pubsub){
			const path=decodeURI(req.path)
			const cloudRes=Object.freeze({
				reply(html,headers={}){
					res.set(headers)
					html.pipe ? html.pipe(res) : res.send(html)
				},
				redirect(){
					res.redirect(...arguments)
				}
			})
			
			let params, matched=statics.find(({path:pattern})=>{
				const matched=path.match(pattern)
				if(matched){
					params=matched.groups
					return true
				}
			})
			if(matched){
				const cloudReq=Object.freeze({
					path,
					url:req.url,
					app:req.app,
					user:req.user,
					headers:{...req.headers},
					query: {...req.query},
					params,
				})
				try{
					matched.callback(cloudReq, cloudRes)
				}catch(error){
					res.status(500).send(`<html><body><pre>${error.stack}</pre></body></html>`)
				}
			}else{
				cloudRes.reply("")
			}
		}
	})
}