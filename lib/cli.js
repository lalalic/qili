#!/usr/bin/env node
const program=require("commander")
const {Application}=require("./app")
const project=require("../package.json")

program
	.version("-v, --version", project.version)
	.description(project.description)
	.usage("[option] <command>")
	
program
	.command("graphql <appId> <query> [variables]")
	.option("-u, --user","user id","")
	.action(async function(id,  query, variables, {user}){
		const app=await Application.create(id)
		user=user ? (await app.getDataLoader("users").load(user)) : null
		const root={}
		const context={user}
		let operationName=getOperationName(query)
		return app.runQL(query,variables,root,{user},operationName)
	})
	
	
program.parse(process.argv)


function getOperationName(query){
	let end=query.indexOf("{")
	let operationName=query.substring(0,end).split(/\s+/).filter(a=>!!a).pop()
	return operationName
}