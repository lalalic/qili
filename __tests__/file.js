const {resolver:fileResolver}=require("../lib/file")
const config=require("../conf")

jest.mock("qiniu", ()=>{
	class PutPolicy{
		token(){
			return this.scope
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

	it("token",()=>{
		let {token,id}=resolver.Query.file_upload_token(null,{},context)
		expect(token).toBeDefined()
		expect(id).toBeDefined()
	})

	describe("scalar URL",()=>{
		context.app.app.storage="xx.qiniu.com"
		it("parse",()=>{
			expect(resolver.URL.parseValue("http://xx.qiniu.com/template/a.docx"))
				.toBe("template/a.docx")
			expect(resolver.URL.parseValue("https://xx.qiniu.com/template/a.docx"))
				.toBe("template/a.docx")
			expect(resolver.URL.parseValue("https://xx.qiniu.com/template/a.docx?12341442"))
				.toBe("template/a.docx?12341442")

			expect(resolver.URL.parseValue("https://xx.mydomain.com/template/a.docx"))
				.toBe("https://xx.mydomain.com/template/a.docx")
			expect(resolver.URL.parseValue("template/a.docx"))
				.toBe("template/a.docx")
			expect(resolver.URL.parseValue(null))
				.toBe(null)

		})
		it("serialize", ()=>{
			expect(resolver.URL.serialize("template/a.docx"))
				.toBe("https://xx.qiniu.com/template/a.docx")

			expect(resolver.URL.serialize("http://a.com/template/a.docx"))
				.toBe("http://a.com/template/a.docx")

			expect(resolver.URL.serialize(""))
				.toBe("")
			expect(resolver.URL.serialize(null))
				.toBe(null)
		})

	})
})
