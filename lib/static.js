const express = require('express')

exports.create=root=>{
	const expressStatic=express.static(root)
	const statics=[]
	const getBestMatch=bestMatchFactory(statics)
	return Object.create({
		on(route, callback){
			statics.push({
				pattern: typeof(route)=="string" ? new RegExp(route.replace(/\/+/g,"/")) : route, 
				callback
			})
			return this
		},
		
		reply(req,  res){
			const path=decodeURI(req.path)
			const {matched, params}=getBestMatch(path)
			if(matched){
				try{
					matched(Object.freeze({
						method:req.method,
						path,
						url:req.url,
						app:req.app,
						user:req.user,
						headers:{...req.headers},
						query: {...req.query},
						params,
						body:req.body
					}), Object.freeze({
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
					}))
				}catch(error){
					res.status(500).send(`<html><body><pre>${error.stack}</pre></body></html>`)
				}
			}else{
				expressStatic(req, res)
			}
		}
	})
}

const bestMatchFactory=patterns=>path=>{
	const matches=patterns.map(({pattern})=>path.match(pattern))
	const best=matches
		.map(a=>!a || a.index!=0 ? 0 : a[0].length)
		.reduce((iMax,weight,i,me)=>{
			return (me[iMax]||0)<weight ? i : iMax
		},-1)

	
	if(best==-1)
		return {}

	return {
		matched: patterns[best].callback,
		params: matches[best].groups
	}
}