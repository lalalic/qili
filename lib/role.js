"use strict"
class Role extends require('./entity'){
	get kind(){return "roles"}

	static get url(){return "/roles"}
}

module.exports=Role
