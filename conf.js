module.exports={
	db : {
		port : 27017,
		host : "qili.db"
	},
	server : {
		port : 9080,
		https : 9443,
		timeout : 120,
		address : "0.0.0.0"
	},
	qiniu:{
		ACCESS_KEY:"1o_JaGUUb8nVxRpDGoAYB9tjLT10WD7PBFVtMmVT",
		SECRET_KEY:"r2nd182ZXzuCiCN7ZLoJPFVPZHqCxaUaE73RjKaW",
		bucket:"mobiengine",
		accessURL:"http://qiniudn.com",
		expires:600,
	},
	debug:true,
	data_inited:false,
	cloud:{
		timeout:3000
	},
	secret:"adfjalfjasdg",
	rootPassword:"root",
	adminKey:"qiliAdmin",
	sharedModules:"underscore,backbone,node-promise,ajax".split(","),
	Internal_API:["users,roles,files,logs".split(",")],
	domain:"http://qili2.com"
}
