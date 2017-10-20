const {Application} = require("../lib/app")

describe("authentication",()=>{
	const APP={apiKey:"test",}
	const USER={_id:"test", phone: "13601230570",}
	const TOKEN="857685"
	beforeAll(()=>{
		Application.prototype.cloudCode=jest.fn().mockImplementation(function(){
			this.cloud={}
		})
	})
	describe("request token", ()=>{
		it.skip("phone", ()=>{
			const app=new Application(APP)
			return app.sendPhoneToken(USER.phone,USER._id,TOKEN)
				.then(({token,uid})=>{
					expect(token).toBe(TOKEN)
					expect(uid).toBe(USER._id)
				},fail)
		})

		it("request token",()=>{
			const app=new Application(APP)
			app.getUserByContact=jest.fn()
				.mockImplementation(()=>Promise.resolve(USER))
			app.sendPhoneToken=jest.fn()
				.mockImplementation((phone,uid,token)=>Promise.resolve({uid,token}))
			app.passwordless.storeOrUpdate=jest.fn()
				.mockImplementation((id,token,timeout,a,callback)=>callback())
			return app.requestToken(USER.phone)
				.then(done=>{
					expect(done).toBe(true)
					expect(app.getUserByContact).toHaveBeenCalled()
					expect(app.sendPhoneToken).toHaveBeenCalled()
					expect(app.passwordless.storeOrUpdate).toHaveBeenCalled()
				},fail)
		})
	})
})
