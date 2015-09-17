var config=require('../conf');
module.exports={
	users:[{ "_id" : config.root, "username" : config.root, "password" : require("../lib/user").prototype.encrypt(config.rootPassword), createdAt : new Date() }],
	apps:[{_id:config.adminKey, apiKey:config.adminKey, token:require("../lib/app").prototype.token(config.adminKey,config.root), name:"admin",author:{_id:config.root,username:config.root}, createdAt: new Date()}]
}
