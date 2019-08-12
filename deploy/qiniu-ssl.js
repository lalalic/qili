const puppeteer = require('puppeteer');
const [, , domain, username, password] = process.argv


async function certificate(name) {
  const browser = await puppeteer.launch({
    //headless:false,
    //executablePath: "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  })
  const page = await browser.newPage()

  async function waitNoLoading() {
    await page.waitForSelector('img[src="https://dn-pili-static.qbox.me/images/loading.gif"]', { hidden: true })
  }

  try {
    const ca = require("fs").readFileSync(`/data/certbot/live/${name}/fullchain.pem`, "ascii")
    const priv = require("fs").readFileSync(`/data/certbot/live/${name}/privkey.pem`, "ascii")

    const navigationPromise = page.waitForNavigation()

    await page.goto('https://portal.qiniu.com/certificate/ssl#cert')

    await page.setViewport({ width: 1280, height: 615 })

    await navigationPromise

    await navigationPromise

    await page.waitForSelector('body > #main > .container')
    await page.click('body > #main > .container')

    await page.type('#main #email', username)
    await page.type('#main #password', password)

    await page.waitForSelector('body > #main #login-button')
    await page.click('body > #main #login-button')

    await navigationPromise

    await waitNoLoading()

    await page.waitForSelector('.comp-cert-list table')

    const first = await page.$$eval('.comp-cert-list table tr.ant-table-row td', tds => tds.map(td => td.textContent))
    await waitNoLoading()

    await page.waitForSelector('.comp-cert-list button.ant-btn')
    await page.click('.comp-cert-list button.ant-btn')

    await page.waitForSelector('.upload-cert-lightbox-form-wrap input#name')
    await page.type('.upload-cert-lightbox-form-wrap input#name', name)
    await page.type('.upload-cert-lightbox-form-wrap textarea#ca', ca)
    await page.type('.upload-cert-lightbox-form-wrap textarea#pri', priv)

    await page.waitForSelector('.upload-cert-lightbox-form-wrap button.ant-btn-primary')
    await page.click('.upload-cert-lightbox-form-wrap button.ant-btn-primary')

    await navigationPromise

    await page.waitForSelector('.upload-cert-lightbox-form-wrap button.ant-btn-primary', { hidden: true })

    const created = await page.$$eval('.comp-cert-list table tr.ant-table-row td', tds => tds.map(td => td.textContent))
    await navigationPromise

    if (!(created[0] != first[0] || created[3] != first[3])) {
      throw new Error("not created!")
    }
  } catch (e) {
    await page.screenshot({ path: `/data/certbot/error/qiniu-${name}-${new Date()}.png` })
    throw e
  } finally {
    await browser.close()
  }
}



; (async () => {
  var count=0
  try {
    await certificate(domain)
  } catch (e) {
    count++
    try{
      await certificate(domain)
    }catch(e){
      count++
    }
  } finally {
    process.exit(count)
  }
})();
