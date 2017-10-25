const {resolver}=require("../lib/file")

describe("file",()=>{
	it("get token", ()=>{
		let {token,id}=resolver.Mutation.file_token(null,{},{app:{app:{apiKey:"test"}},user:{sessionToken:"456789ghjkl"}})
		expect(token).toBeDefined()
		expect(id).toBeDefined()
	})
	
	it("user.sessionToken",()=>{
		
	})
})