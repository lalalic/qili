const express = require('express')
const conf=require('../conf')

exports.create=(root)=>{
	const tryRoot=(req, res, next)=>{
		next=next || (()=>res.status(404).end());
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

						if(matched.isRoute || matched.isAuth){
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
								status(v){
									res.statusCode=v
									return this
								},
								redirect(){
									res.redirect(...arguments)
									return this
								},
								json(){
									res.json(...arguments)
									return this
								},
								setHeader(key,value){
									res.setHeader(...arguments)
									return this
								},
								write(){
									res.write(...arguments)
									return this
								},
								end(){
									res.end(...arguments)
									return this
								},
								cookie(){
									res.cookie(...arguments)
									return this
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

		router(path, fallbackUrl){
			const route = express.Router()

			this.on(path, Object.assign(function(req, res){
				route(req, res, ()=>tryRoot(req, res, ()=>{
					if(fallbackUrl){
						req.url=fallbackUrl
						tryRoot(req, res, ()=>res.status(404).end())
					}else{
						res.status(404).end()
					}
				}))
			},{isRoute:true}))
			return new Proxy(route,{
				get(target, key){
					if(key in target){
						return Reflect.get(target, key)
					}
					return ()=>void(0)
				}
			})
		},

		auth2(options){
			Object.entries(options).forEach(([name, {strategy, scope, redirectUrl}={}])=>{
				if(!strategy)
					return 
				const key=`${name}_${uuid++}`
				conf.passport.use(key, strategy)

				//const authenticate1=conf.passport.authenticate(key, {scope})
				this.on(`/auth/${name}`,Object.assign((req, res)=>{
					const authenticate1=conf.passport.authenticate(key, {
						scope, 
						callbackURL:req.url.replace(name,`${name}/callback`)
					})
					authenticate1(req, res)
				},{isAuth:true}))

				
				const callbackURL=`/auth/${name}/callback`
				this.on(callbackURL, Object.assign((req, res)=>{
					const authenticate2=conf.passport.authenticate(key, {
						callbackURL:req.url.split("?")[0]
					})
					authenticate2(req, res, ()=>{
						const url=(()=>{
							switch(typeof(redirectUrl)){
								case "function":
									return redirectUrl(req, res)
								case "object":{
									const [,,,,ctx]=req.url.split(/[\/\?]/)
									return (redirectUrl[ctx]||redirectUrl.default)?.(req, res)
								}
								case "string":
									return redirectUrl
							}
						})();
						res.redirect(url||"/")
					})
				},{
					isAuth:true,
					finalize(){
						conf.passport.unuse(key)
					}
				}))
			})
		},

		finalize(){
			[...statics,...before].forEach(callback=>{
				callback.finalize?.()
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

let uuid=0