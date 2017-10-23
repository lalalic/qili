const {resolver}=require("../lib/file")

describe("file",()=>{
	it("get tokens", ()=>{
		let tokens=resolver.Mutation.file_tokens(null,{count:5},{app:{apiKey:"test"},user:{sessionToken:"456789ghjkl"}})
		expect(Array.isArray(tokens)).toBe(true)
		expect(tokens.length).toBe(5)	
	})
	
	it("user.sessionToken",()=>{
		
	})
})