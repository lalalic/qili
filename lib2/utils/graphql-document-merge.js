exports.merge=function(...parts){
	return parts.slice(1).reduce(({definitions}, {definitions:merging})=>{
		merging.forEach(def=>{
			let found=definitions.find(
				({kind, name: {value: name}})=>def.kind==kind && def.name.value==name
			)
			if(!found){
				definitions.push(found)
			}else if(def.kind=="ObjectTypeDefinition":{
				mergeByName(target.fields, def.fields)
				mergeByName(target.interfaces, def.interfaces)
			}
	},parts[0])
}

function mergeByName(aa,bb){
	bb.forEach(b=>{
		let found=aa.findIndex(({name:{value:name}})=>b.name.value==name)	
		if(found==-1){
			aa.push(b)
		}else{
			aa.splice(found,1,b)
		}
	})
}