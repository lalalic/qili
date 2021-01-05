const logger=require("./logger")
const Schema=require("./schema")

exports.extend=(app, config)=>{
	app.use('/:appKey/static', (req, res, next)=>{
		req.headers['x-application-id']=req.params.appKey
		require('./app').resolve()(req, res, (error)=>{//resolve app
			if(error){
				next(error)
			}else if(req.app && req.app.cloud && req.app.cloud.static){
				const cloud=req.app.cloud
				require('./user').web_auth()(req,res,()=>{
					cloud.static.reply(req,res)
				})
			}
		})
	})
	logger.info(`app[${app.name}] static service installed`)
}

exports.create=()=>{
	const statics=[]
	return Object.create({
		on(path, callback){
			statics.push({path,callback})
			return this
		},
		
		reply(req,  res, pubsub){
			const path=req.path
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