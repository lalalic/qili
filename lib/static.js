const express = require('express')
const conf=require('../conf')

exports.create=(root)=>{
	const tryRoot=(req, res, next)=>{
		if(!next){
			next=()=>{
				res.status(404).end()
			}
		}
		expressStatic(req, res, next)
	}
	
	const expressStatic=(roots=>{
		const routes=roots.map(a=>{
			if(typeof(a)=="object"){
				return express.static(a.root, a.options)
			}else{
				return express.static(a)
			}
		})
		return function (req, res, next){
			routes.reduceRight((next, current)=>{
				return (req, res)=>current(req, res, ()=>next(req, res))
			},next)(req, res);
		}
	})(Array.isArray(root) ? root : [root]);

	const statics=[], before=[]
	const getBestMatch=bestMatchFactory(statics)
	const getBestMatchBefore=bestMatchFactory(before)
	
	return Object.create({
		internalRootUrl:app=>`http://localhost:${conf.server.port}/${conf.version}/${app.app.apiKey}/static`,
		on(route, callback){
			statics.push({
				pattern: typeof(route)=="string" ? new RegExp(route.replace(/\/+/g,"/")) : route, 
				callback
			})
			return this
		},
		before(route, callback){
			before.push({
				pattern: typeof(route)=="string" ? new RegExp(route.replace(/\/+/g,"/")) : route, 
				callback
			})
			return this
		},
		
		reply(req,  res, next){
			try{
				const path=decodeURI(req.path)
				const beforeMatched=getBestMatchBefore(path)
				beforeMatched.matched?.(...arguments)
				const {matched, params}=getBestMatch(path)
				if(matched){
					try{
						req.app.emit('static.matched', path)

						if(matched.isRoute){
							matched(...arguments)
						}else{
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
						}
					}catch(error){
						res.status(500).send(`<html><body><pre>${error.stack}</pre></body></html>`)
					}
				}else{
					req.app.emit('static', req.url)
					tryRoot(req, res)
				}
			}catch(e){
				console.error(`request[${req.path}]: ${e.message}. Redirect to /`)
				res.redirect("/")
			}
		},

		router(path="/"){
			const route = express.Router()

			this.on(path, Object.assign(function(req, res){
				const fallback=()=>{
					req.url="/"
					tryRoot(req, res)
				}
				if(path=="/"){
					tryRoot(req, res, ()=>route(req, res, fallback))
				}else{
					route(req, res, ()=>tryRoot(req, res, fallback))
				}
			},{isRoute:true}))
			return new Proxy(route,{
				get(target, key){
					if(key in target){
						return Reflect.get(target, key)
					}
					return ()=>void(0)
				}
			})
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