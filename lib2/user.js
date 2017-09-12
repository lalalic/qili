const graphql=require('express-graphql')

exports.graphql_auth=function(options){
	let middleware=graphql(options)
	return function(error, req, res, next){
		if(req.user){
			next()
		}else{
			middleware(req, res, next)
		}
	}
}

exports.resolver={
	User: {
		token(user,args,{app}){
			return app.encode(user)
		},
		
		async roles({roles=[]},args,{app}){
			let conn=await app.collection("roles")
			try{
				return Promise.all(roles.map(_id=>conn.findOne({_id})))
			}finally{
				conn.close()	
			}
		}
	}
}