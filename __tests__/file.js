const {resolver:fileResolver}=require("../lib/file")
const config=require("../conf")

jest.mock("qiniu", ()=>{
	class PutPolicy{
		token(){
			let data=this.scope.split(":")
			return data.length==1 ? this.scope : data[1]
		}
	}

	return {
		rs: {
			PutPolicy
		},
		conf:{

		}
	}
})

describe("file",()=>{
	const context={app:{app:{apiKey:"test"}},user:{sessionToken:"456789ghjkl",_id:"test"}}
	const resolver=fileResolver(context.app.app)
	it("{host:undefined,path:undefined}", ()=>{
		let {token,id}=resolver.Query.file_upload_token(null,{},context)
		expect(token)
			.toMatch(`${context.app.app.apiKey}/users/${context.user._id}/`)
		expect(id).not.toBeDefined()
	})

	it("{host:'books'}",()=>{
		let {token,id}=resolver.Query.file_upload_token(null,{host:'books'},context)
		expect(token)
			.toMatch(`${context.app.app.apiKey}/books/`)
		expect(id).toMatch('books:')
	})

	it("{host:'books:22222'}",()=>{
		let {token,id}=resolver.Query.file_upload_token(null,{host:'books:22222'},context)
		expect(token)
			.toMatch(`${context.app.app.apiKey}/books/22222/`)
		expect(id).not.toBeDefined()
	})

	it("{path:'book/a.pdf'}",()=>{
		let {token,id}=resolver.Query.file_upload_token(null,{path:'book/a.pdf'},context)
		expect(token)
			.toMatch(`${context.app.app.apiKey}/users/${context.user._id}/book/a.pdf`)
		expect(id).not.toBeDefined()
	})

	it("{justToken:true}",()=>{
		let {token,id}=resolver.Query.file_upload_token(null,{justToken:true},context)
		expect(token).toBe(config.qiniu.bucket)
		expect(id).toBeDefined()
	})

	describe("scalar URL",()=>{
		context.app.app.storage=["xx.qiniu.com","bb.qiniu.com"]
		it("parse",()=>{
			expect(resolver.URL.parseValue("http://xx.qiniu.com/template/a.docx"))
				.toBe("/template/a.docx")
			expect(resolver.URL.parseValue("http://xx.mydomain.com/template/a.docx"))
				.toBe("http://xx.mydomain.com/template/a.docx")
			expect(resolver.URL.parseValue("template/a.docx"))
				.toBe("template/a.docx")
			expect(resolver.URL.parseValue(null))
				.toBe(null)
			expect(resolver.URL.parseValue("http://bb.qiniu.com/template/a.docx"))
				.toBe("/template/a.docx")

		})
		it("serialize", ()=>{
			expect(resolver.URL.serialize("/template/a.docx"))
				.toBe("http://bb.qiniu.com/template/a.docx")

			expect(resolver.URL.serialize("http://a.com/template/a.docx"))
				.toBe("http://a.com/template/a.docx")

			expect(resolver.URL.serialize(""))
				.toBe("")
			expect(resolver.URL.serialize(null))
				.toBe(null)
		})

	})
})
