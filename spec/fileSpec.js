"use strict"

xdescribe('File Service', function(){
	var config=require('./config'),
		host=config.host,
		root=host+"/files",
		$=require('./ajax')(),
		qiniu=require('qiniu');

	beforeAll((done)=>config.init().then(done,done)	)
	afterAll((done)=>config.release().then(done,done))

	var uid=Date.now(),
		NULL=()=>1,
		getToken,
		upload,
		entity={kind:'user',_id:config.tester._id},
		getKey=(id)=>`${config.testApp.apiKey}/user/${entity._id}/${id||(uid++)}`;


	it('token',getToken=function(done){
		return $.get(`${root}/token`).then(function(r){
			expect(r.token).toBeDefined()
			expect(r.expires).toBeDefined()
			done()
			return r.token
		},done)
	})

	describe("upload", function(){
		upload=(done, content, keyId,extra)=>{
			return getToken(NULL).then((token)=>{
				return new Promise((resolve, reject)=>
					qiniu.io.put(token,getKey(keyId),content||"test",extra, (e,ret)=>{
						if(e){
							reject(e)
							done()
							return
						}
						expect(ret.url).toBeDefined()
						expect(ret.url).toMatch(`${config.server.qiniu.accessURL}/${config.testApp.apiKey}/user/${config.tester._id}/`)
						done()
						resolve(ret)
					})
				)
			},done)
		}

		it("simple content and get url", (done)=>upload(done).catch(fail), 8000)

		it("upload multiple times with one token", (done)=>{
			let doUpload=(token)=>{
				return new Promise((resolve, reject)=>
					qiniu.io.put(token,getKey(),"test",null, (e,ret)=>{
						if(e){
							fail();
							reject(e)
							return
						}
						expect(ret.url).toBeDefined()
						expect(ret.url).toMatch(`${config.server.qiniu.accessURL}/${config.testApp.apiKey}/user/${config.tester._id}/`)
						resolve(ret.url)
					})
				)
			};
			getToken(NULL).then((token)=>{
				Promise.all([
					doUpload(token),
					doUpload(token),
					doUpload(token)
				]).then(done,$.fail(done))
			},done)
		},8000)

		it("can't replace", function(done){
			upload(NULL,"test replace","replaceit").then(()=>{
				upload(NULL,"test replace2","replaceit").then(()=>{
					fail("should not be replaced")
					done()
				},done)
			},$.fail(done,"first upload failed"))
		})

		it("with mimeType, entity, and crc", function(done){
			upload(NULL,null,null,{
				mimeType:"text/plain",
				params:{
					"x:entity":JSON.stringify(entity),
					"x:crc":"54"//must be string
				}
			}).then((file)=>{
				expect(file.mimeType).toBe("text/plain")
				expect(file.entity).toBeDefined()
				expect(file.entity._id).toBe(entity._id)
				expect(file.crc).toBe(54)
				done()
			},$.fail(done))
		})

		it("to replace", function(){
			fail("not implement yet")
		})
		it("images", function(done){
			var params={"x:entity":JSON.stringify(entity)}
			getToken(NULL).then((token)=>{
				qiniu.io.putFile(token,getKey(),"./data/a.gif",{params},(error, response)=>{
					if(error){
						fail(JSON.stringify(error))
						done()
						return
					}
					expect(response.url).toBeDefined()
					expect(response.entity).toBeDefined()
					expect(response.mimeType).toMatch(/image/i)
					done()
				})
			},done)
		})

		it("docx with information in qili server", function(done){
			var params={"x:entity":JSON.stringify(entity)}
			getToken(NULL).then((token)=>{
				qiniu.io.putFile(token,getKey(),"./data/a.docx",{params},(error, response)=>{
					if(error){
						fail(JSON.stringify(error))
						done()
						return
					}
					console.dir(response)
					expect(response.url).toBeDefined()
					expect(response.entity).toBeDefined()
					expect(response.mimeType).toMatch(/image/i)
					done()
				})
			},done)
		})
	})

	describe("remove", function(){
		it("one file", function(){
			fail("not implement")
		})

		it("remove files for entity", function(){
			fail("not implement")
		})

		it("trim file system", function(){
			fail("not implement")
		})
	})
})
