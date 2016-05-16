var config=require('../conf'),now=new Date();
module.exports={
	users:[{ "_id" : config.root, "username" : config.root, "password" : require("../lib/user").prototype.encrypt(config.rootPassword), createdAt : now }],
	apps:[{_id:config.adminKey, apiKey:config.adminKey, token:require("../lib/app").asObjectId(), name:"admin",author:{_id:config.root,username:config.root}, createdAt: now}]
}
