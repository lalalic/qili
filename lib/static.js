const fs=require("fs")
exports.create=root=>{
	const statics=[]
	const diskCaches={}
	return Object.create({
		on(path, callback){
			statics.push({path: path.replace(/\/+/g,"/"), callback})
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
				set statusCode(v){
					res.statusCode=v
				},
				redirect(){
					res.redirect(...arguments)
				},
				json(){
					res.json(...arguments)
				},
				setHeader(key,value){
					res.setHeader(...arguments)
				},
				write(){
					res.write(...arguments)
				},
				end(){
					res.end(...arguments)
				}
			})

			if(root){
				let fpath=`${root}${path}`
				if(fs.existsSync(fpath)){
					const stat=fs.statSync(fpath)
					if(stat.isFile()){
						diskCaches[fpath]=stat.mtimeMs+""
					}else if(stat.isDirectory()){
						const index=["index.html","index.htm"].find(a=>fs.existsSync(`${fpath}/${a}`))
						if(index){
							fpath=`${fpath}/${index}`
							diskCaches[fpath]=fs.statSync(fpath).mtimeMs+""
						}
					}

					if(diskCaches[fpath]){
						try{
							if(req.headers["if-none-match"]==diskCaches[fpath]){
								return cloudRes.reply(304)
							}else{
								return cloudRes.reply(fs.createReadStream(fpath),{ETag:diskCaches[fpath]})
							}
						}catch(e){
							delete diskCaches[fpath]
						}
					}
				}
			}
			
			
			let params, matched=statics.find(({path:pattern})=>{
				const matched=typeof(pattern)=="string" ? path.startsWith(pattern) : path.match(pattern)
				if(matched){
					params=matched.groups
					return true
				}
			})
			if(matched){
				const cloudReq=Object.freeze({
					method:req.method,
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
				res.status(404).send('404: no this resource')
			}
		}
	})
}