var Entity=require('./entity')

export default class Main extends Entity{
	get kind(){
		return "roles"
	}

	static get url(){
		return "/roles"
	}
}
