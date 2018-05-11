const {resolver}=require("../lib/file")

describe("file",()=>{
	const context={app:{app:{apiKey:"test"}},user:{sessionToken:"456789ghjkl"}}
	
	it("{host:undefined,path:undefined}", ()=>{
		let {token,id}=resolver.Query.file_upload_token(null,{},context)
		expect(token).toBeDefined()
		expect(id).toBeDefined()
	})
	
	it("{host:'books'}",()=>{
		let {token,id}=resolver.Query.file_upload_token(null,{host:'books'},context)
		expect(token).toBeDefined()
		expect(id).toBeDefined()
	})
	
	it("{host:'books:22222'}",()=>{
		let {token,id}=resolver.Query.file_upload_token(null,{host:'books:22222'},context)
		expect(token).toBeDefined()
		expect(id).not.toBeDefined()
	})
	
	it("{path:'book/a.pdf'}",()=>{
		let {token,id}=resolver.Query.file_upload_token(null,{host:'books:22222'},context)
		expect(token).toBeDefined()
		expect(id).toBeDefined()
	})
})