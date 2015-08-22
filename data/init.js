var config=require('../conf');
module.exports={
	users:[{ "_id" : "root", "username" : "root", "password" : require("../lib/user").prototype.encrypt(config.rootPassword), createdAt : new Date() }],
	apps:[{_id:config.adminKey, apiKey:config.adminKey, token:require("../lib/app").prototype.token(config.adminKey,"root"), name:"admin",author:{_id:"root",username:"root"}, createdAt: new Date()}]
}
