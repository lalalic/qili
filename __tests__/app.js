const {Application} = require("../lib/app")
const config=require("../conf")
config.debug=false

let uuid=Date.now()

describe("authentication",()=>{
	const USER={_id:"test", phone: "13901234567",username:"test"}
	const TOKEN="857685"
	const createApp=()=>new Application({apiKey:`${uuid++}`,_id:`${uuid-1}_id`})
	beforeAll(()=>{
		Application.prototype.cloudCode=jest.fn().mockImplementation(function(){
			this.cloud={}
		})
	})
	describe("request token", ()=>{
		it.skip("phone", ()=>{
			const app=createApp()
			return app.sendPhoneToken(USER.phone,USER._id,TOKEN)
				.then(({token,uid})=>{
					expect(token).toBe(TOKEN)
					expect(uid).toBe(USER._id)
				},fail)
		})

		it("request for existing user",()=>{
			const app=createApp()
			app.getUserByContact=jest.fn()
				.mockImplementation(()=>Promise.resolve(USER))
				
			app.sendPhoneToken=jest.fn()
				.mockImplementation((phone,uid,token)=>Promise.resolve({uid,token}))

			expect(app.passwordless).toBeDefined()
			app.passwordless.storeOrUpdate=jest.fn()
				.mockImplementation((id,token,timeout,a,callback)=>callback())
			return app.requestToken(USER.phone)
				.then(done=>{
					expect(done).toBe(true)
					expect(app.getUserByContact).toHaveBeenCalled()
					expect(app.sendPhoneToken).toHaveBeenCalled()
					expect(app.passwordless.storeOrUpdate).toHaveBeenCalled()
					let [contact,uid]=app.sendPhoneToken.mock.calls[0]
					expect(contact).toBe(USER.phone)
					expect(uid).toBe(USER._id)
				},fail)
		})
		
		it("request for new user", ()=>{
			const app=createApp()
			app.getUserByContact=jest.fn()
				.mockImplementation(()=>Promise.resolve())
			app.sendPhoneToken=jest.fn()
				.mockImplementation((phone,uid,token)=>Promise.resolve({uid,token}))

			expect(app.passwordless).toBeDefined()
			app.passwordless.storeOrUpdate=jest.fn()
				.mockImplementation((id,token,timeout,a,callback)=>callback())
			return app.requestToken(USER.phone)
				.then(done=>{
					expect(done).toBe(false)
					expect(app.getUserByContact).toHaveBeenCalled()
					expect(app.sendPhoneToken).toHaveBeenCalled()
					expect(app.passwordless.storeOrUpdate).toHaveBeenCalled()
					let [contact,uid]=app.sendPhoneToken.mock.calls[0]
					expect(contact).toBe(USER.phone)
					expect(uid).toBe(USER.phone)
				},fail)
		})
	})
	
	describe("login", ()=>{
		it("existing user",()=>{
			const app=createApp()
			app.getUserByContact=jest.fn()
				.mockImplementation(()=>Promise.resolve(USER))
				
			expect(app.passwordless).toBeDefined()
			app.passwordless.authenticate=jest.fn()
				.mockImplementation((token,uid,callback)=>callback(null,true))
			app.passwordless.invalidateUser=jest.fn()
			app.createEntity=jest.fn()
				.mockReturnValue(Promise.resolve(USER))
			
			return app.login(USER.phone, TOKEN)
				.then(user=>{
					expect(user).toBe(USER)
					expect(app.getUserByContact).toHaveBeenCalled()
					expect(app.passwordless.authenticate).toHaveBeenCalled()
					expect(app.passwordless.invalidateUser).toHaveBeenCalled()
					expect(app.createEntity).not.toHaveBeenCalled()
				})
		})
		
		it("new user will be created when login", ()=>{
			const app=createApp()
			app.getUserByContact=jest.fn()
				.mockImplementation(()=>Promise.resolve())
				
			expect(app.passwordless).toBeDefined()
			app.passwordless.authenticate=jest.fn()
				.mockImplementation((token,uid,callback)=>callback(null,true))
			app.passwordless.invalidateUser=jest.fn()
			
			let newUser={...USER,_id:"hello"}
			app.createEntity=jest.fn()
				.mockReturnValue(Promise.resolve(newUser))
			
			return app.login(USER.phone, TOKEN,USER.username)
				.then(user=>{
					expect(user).toBe(newUser)
					expect(app.getUserByContact).toHaveBeenCalled()
					expect(app.passwordless.authenticate).toHaveBeenCalled()
					expect(app.passwordless.invalidateUser).toHaveBeenCalled()
					expect(app.createEntity).toHaveBeenCalled()
				})
		})
		
		it("new user without login success will be created when login", ()=>{
			const app=createApp()
			app.getUserByContact=jest.fn()
				.mockImplementation(()=>Promise.resolve())
				
			expect(app.passwordless).toBeDefined()
			app.passwordless.authenticate=jest.fn()
				.mockImplementation((token,uid,callback)=>callback(null,false))
			app.passwordless.invalidateUser=jest.fn()
			
			let newUser={...USER,_id:"hello"}
			app.createEntity=jest.fn()
				.mockReturnValue(Promise.resolve(newUser))
			
			return app.login(USER.phone, TOKEN,USER.username)
				.then(fail,e=>{
					expect(e).toBeDefined()
				})
		})
	})
})
