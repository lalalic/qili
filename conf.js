module.exports={
	debug:true,
	version:"1",
	db : {
		port : 27017,
		host : "qili.db"
	},
	server : {
		port : 8080,
		https : 8443,
		timeout : 120
	},
	qiniu:{
		ACCESS_KEY:"1o_JaGUUb8nVxRpDGoAYB9tjLT10WD7PBFVtMmVT",
		SECRET_KEY:"r2nd182ZXzuCiCN7ZLoJPFVPZHqCxaUaE73RjKaW",
		bucket:"qili2-app",
		accessURL:"http://app.qili2.com",
		expires:600,
	},
	domain:"http://qili2.com", //qiniu need it
	cloud:{
		timeout:3000
	},
	appRoot:`${__dirname}/apps`,
	token:"thirdtoken",//such as wechat api token
	secret:"abcdef",
	root:"root",
	rootPassword:"root",
	adminKey:"qiliAdmin",
	sharedModules:"backbone,ajax".split(","),
	Internal_API:["users,roles,files,logs".split(",")]
}
