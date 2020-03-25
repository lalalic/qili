#!/usr/bin/env node
const program=require("commander")
const {Application}=require("./app")
const project=require("../package.json")
const logger=require("./logger")
let {debug, cloud:{timeout=30*1000}}=require("../conf")
if(debug)
	timeout=10*60*1000

if(require.main==module){
	program
		.version(project.version,"-v, --version")
		.description(project.description)
		.usage("[option] <command>")

	program
		.command("graphql <appId> <query> [variables]")
		.option("-u, --user <user>","user id","")
		.action(async function(id,  query, variables, {user}){
			const app=await Application.create(id)
			user=user ? (await app.getDataLoader("User").load(user)) : {}
			const root={}
			const context={user}
			return app.runQL(query,JSON.parse(variables),root,{user})
		})

	program
		.command("channel")
		.description("***not support from command line")
		.action(function(){
			return new Promise((resolve,reject)=>{
				process.on("message",function({app,user,query,variables}){
					(new Application(app))
						.runQL(query,variables,{},{user})
						.then(result=>{
							process.send(result)
							process.disconnect()
							process.exit(0)
							resolve()
						})
						.catch(logger.error)
				})
			})
		})
	program.parse(process.argv)
}else{
	exports.inspect=function({app,user,body:{query,variables}}, res, next){
		if(app.isAdmin()||app.canRunInCore){
			logger.debug(`run on core mode`)
			next()
		}else{
			logger.debug(`run on cli mode`)
			const p=require("child_process").fork(
					module.filename,
					["channel"],
					{
						execArgv:[]//["--inspect-port=9222", "--inspect-brk"]
					}
				)

			const timer=setTimeout(()=>{
				logger.debug(`timeout in cli mode`)
				p.kill()
				res.status(408).send(`cloud code runs more than ${timeout}ms`)
			},timeout)

			p.on("error",(e)=>{
				logger.error(e)
				clearTimeout(timer)
				p.kill()
				res.status(500).send(e.message)
			})

			p.on("message",result=>{
				clearTimeout(timer)
				res.json(result)
			})
			p.send({user,app:app.app,query,variables})
		}
	}
}
