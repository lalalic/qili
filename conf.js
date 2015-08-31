module.exports={
	version:"1",
	db : {
		port : 27017,
		host : "qili.db"
	},
	server : {
		port : 9080,
		https : 9443,
		timeout : 120
	},
	qiniu:{
		ACCESS_KEY:"",
		SECRET_KEY:"",
		bucket:"",
		accessURL:"http://qiniudn.com",
		expires:600,
	},
	domain:"http://qili2.com", //qiniu need it
	debug:false,
	data_inited:false,
	cloud:{
		timeout:3000
	},
	secret:"abcdef",
	rootPassword:"root",
	adminKey:"qiliAdmin",
	sharedModules:"underscore,backbone,node-promise,ajax".split(","),
	Internal_API:["users,roles,files,logs".split(",")]
}
