module.exports={
	users:[{username:1, $option:{unique:true}},{email:1, $option:{unique:true, sparse:true}}],
	roles:[{name:1, $option:{unique:true}}],
	apps:[{'author._id':1,'name':1, $option:{unique:true}}],
	logs:[{level:1}, {'message.path':1, $option:{name:'accesspath', spare:true}}]
}

/*
log={
	createdAt:new Date(), 
	level:9,
	message:{
		remote:	req.ip||req._remoteAddress||(req.connection&&req.connection.remoteAddress),
		method: req.method,
		path: req.originalUrl || req.url,
		httpVersion: req.httpVersionMajor + '.' + req.httpVersionMinor,
		referrer: req.headers['referer'] || req.headers['referrer'],
		userAgent: req.headers['user-agent']
	}
}
*/