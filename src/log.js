var Entity=require("./entity")

var Entity=require('./entity')

export default class Main extends Entity{
	get kind(){
		return "logd"
	}

	clear(){

	}

	static get url(){
		return "/logs"
	}

	static get routes(){
		return{
			"get reset4Test": Entity.routes['get reset4Test'],
			"get :id?" : Entity.routes["get :id?"],
			"get dump" : function(req, res){
				new this(req,res).dump()
				.then(function(m){
					this.send(res,m)
				}.bind(this), this.error(res))
			},
			"post clear" : function(req, res){
				new this(req, res).clear()
				.then(function(m){
					this.send(res,m)
				}.bind(this), this.error(res))
			}
		}
	}
}



module.exports=Super.extend({
	kind:"logs",
	clear: function(){

	}
},{
	url:"/logs",
	routes:{
		"get reset4Test": Super.routes['get reset4Test'],
		"get :id?" : Super.routes["get :id?"],
		"get dump" : function(req, res){
			new this(req,res).dump()
			.then(function(m){
				this.send(res,m)
			}.bind(this), this.error(res))
		},
		"post clear" : function(req, res){
			new this(req, res).clear()
			.then(function(m){
				this.send(res,m)
			}.bind(this), this.error(res))
		}
	}
})