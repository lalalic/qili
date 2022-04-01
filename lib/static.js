const fs=require("fs")
exports.create=root=>{
	const statics=[]
	const diskCaches={}
	return Object.create({
		on(path, callback){
			statics.push({path,callback})
			return this
		},
		
		reply(req,  res){
			const path=decodeURI(req.path)
			const cloudRes=Object.freeze({
				reply(html,headers={}){
					res.set(headers)
					if(Number.isInteger(html)){
						res.status(html).send()
					}else if(html.pipe){
						html.pipe(res)
					}else{
						res.send(html)
					}
				},
				redirect(){
					res.redirect(...arguments)
				}
			})

			const fpath=`${root}${path}`
			if(root){
				if(!(fpath in diskCaches)){
					if(fs.existsSync(fpath)){
						const stat=fs.lstatSync(fpath)
						if(stat.isFile()){
							diskCaches[fpath]=stat.mtimeMs+""
						}
					}
				}
				if(diskCaches[fpath]){
					try{
						if(req.headers["if-none-match"]==diskCaches[fpath]){
							return cloudRes.reply(304)
						}else{
							return cloudRes.reply(fs.createReadStream(`${root}${path}`),{ETag:diskCaches[fpath]})
						}
					}catch(e){
						delete diskCaches[fpath]
					}
				}
			}
			
			
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
					resolve:path=>{
						if(root){
							return fs.readFileSync(`${root}${path}`,"utf-8")
						}
					}
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