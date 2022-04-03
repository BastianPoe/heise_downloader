const fs = require("fs");
const os = require('os');
const path = require('path');
const request = require("request-promise-native");
const puppeteer = require('puppeteer');
const hummus = require('hummus');

async function downloadPDF(pdfURL, outputFilename) {
    let pdfBuffer = await request.get({uri: pdfURL, encoding: null});
    fs.writeFileSync(outputFilename, pdfBuffer);
}

async function main() {
    const myArgs = process.argv.slice(2);
    
    if( myArgs.length != 6 ) {
        console.log("Usage: node heise_downloader.js <email> <password> <magazine> <year> <issue> <output file>");
        return;
    }

    email = myArgs[0];
    password = myArgs[1];
    magazine = myArgs[2];
    year = myArgs[3];
    issue = myArgs[4];
    outputFile = myArgs[5];

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "heise_downloader"));
    console.log("Using temp dir " + tmpDir);
    
    console.log("Starting headless chrome...");
    const browser = await puppeteer.launch({ headless: true });

    console.log("Opening heise SSO page...");
    const page = await browser.newPage();
    await page.goto('https://www.heise.de/sso/login/', {
            waitUntil: 'networkidle2',
    });

    console.log("Logging in...");
    await page.type('#login-user', email);
    await page.type('#login-password', password);

    await page.click('[name="rm_login"]', {
            waitUntil: 'networkidle2',
    });

    console.log("Login OK, waiting for consent iframe");

    const consent_iframe = await page.waitForSelector('iframe[id="sp_message_iframe_619211"]');

    const iframe = await consent_iframe.contentFrame();

    await iframe.waitForSelector('button[title="Zustimmen"]');
    
    await iframe.click('button[title="Zustimmen"]', {
            waitUntil: 'networkidle2',
    });
    
    console.log("Gave cookie consent");

    await page.waitForTimeout(1000)		

    console.log("Opening magazine issue...");
    await page.goto('https://www.heise.de/select/' + magazine + '/' + year + '/' + issue + '/', {
            waitUntil: 'networkidle2',
    });


    console.log("Going to title page...");
    var previousPagesExist = true;
    while( previousPagesExist ) {
        try {
            console.log("--> Going back a page");
            await page.waitForSelector('a[class="nav__link nav__link--prev"]', { timeout: 1000 })
            
            await page.click('a[class="nav__link nav__link--prev"]', {
                    waitUntil: 'networkidle2',
            });
        } catch (error) {
            previousPagesExist = false;
            console.log("--> Found title page");
        }
    }

    var pageCounter = 1;

    var lastPage = false;

    page.setDefaultTimeout(5000);

    console.log("Starting to download pages...");
    do {
        console.log(pageCounter + ": URL: " + page.url());
    
        await page.waitForTimeout(10000)		
 
        var generatePdf = false;
        try {
            await page.waitForSelector('a[aria-label="Artikel als PDF herunterladen"]');
        } catch (e) {
            generatePdf = true;
        }
      
        var nextUrl = null;

        try { 
		await page.waitForSelector('a[class="nav__link nav__link--next"]'); 

		nextUrl = await page.$$eval('a[class="nav__link nav__link--next"]', anchors => [].map.call(anchors, a => a.href));
		if( nextUrl.length < 1 ) {
			nextUrl = null;
		}
        } catch (e) {
            console.log("Last page");
            lastPage = true;
        }

        const filename = path.join(tmpDir, pageCounter.toString().padStart(3, '0') + ".pdf");

        if( fs.existsSync(filename) ) {
            console.log("--> " + filename + " exists, skipping");
        } else {
            if( generatePdf ) {
                console.log("--> saving generated PDF to " + filename + "...");
               
                try { 
                    await page.waitForSelector('p[class="comment"]');
                    await page.evaluate(() => {
                        let dom = document.querySelector('p[class="comment"]');
                        dom.parentNode.removeChild(dom);
                    });
                } catch (e) {
                }

                try { 
                    await page.waitForSelector('header', { timeout: 1000 });
                    await page.evaluate(() => {
                        let dom = document.querySelector('header', { timeout: 1000 });
                        dom.parentNode.removeChild(dom);
                    });
                } catch (e) {
                }
                
                try { 
                    await page.waitForSelector('div[class="meta meta--ct"]', { timeout: 1000 });
                    await page.evaluate(() => {
                        let dom = document.querySelector('div[class="meta meta--ct"]');
                        dom.parentNode.removeChild(dom);
                    });
                } catch (e) {
                }
 

                try { 
                    await page.waitForSelector('div[class="pswp"]', { timeout: 1000 });
                    await page.evaluate(() => {
                        let dom = document.querySelector('div[class="pswp"]', { timeout: 1000 });
                        dom.parentNode.removeChild(dom);
                    });
                } catch (e) {
                }
 

                try { 
                    await page.waitForSelector('div[class="bottom-links"]', { timeout: 1000 });
                    await page.evaluate(() => {
                        let dom = document.querySelector('div[class="bottom-links"]', { timeout: 1000 });
                        dom.parentNode.removeChild(dom);
                    });
                } catch (e) {
                }
 

                try { 
                    await page.waitForSelector('footer[class="footer"]', { timeout: 1000 });
                    await page.evaluate(() => {
                        let dom = document.querySelector('footer[class="footer"]', { timeout: 1000 });
                        dom.parentNode.removeChild(dom);
                    });
                } catch (e) {
                }
 
                try { 
                    await page.waitForSelector('div[class="toolbar"]', { timeout: 1000 });
                    await page.evaluate(() => {
                        let dom = document.querySelector('div[class="toolbar"]', { timeout: 1000 });
                        dom.parentNode.removeChild(dom);
                    });
                } catch (e) {
                }

		// Scroll one viewport at a time, pausing to let content load
		const bodyHandle = await page.$('body');
		const boundingBox = await bodyHandle.boundingBox();
		const height = await boundingBox.height;
		const viewportHeight = await page.viewport().height;

		let viewportIncr = 0;
		while (viewportIncr + viewportHeight < height) {
			await page.evaluate(_viewportHeight => {
				window.scrollBy(0, _viewportHeight);
			}, viewportHeight);
        		await page.waitForTimeout(2000)		
			viewportIncr = viewportIncr + viewportHeight;
		}
        	await page.waitForTimeout(5000)		

                const pdfBuffer = await page.pdf({ format: 'A4' });
                fs.writeFileSync(filename, pdfBuffer);
            } else {
                console.log("--> writing downloaded PDF to " + filename + "...");
                const url = await page.$$eval('a[aria-label="Artikel als PDF herunterladen"]', anchors => [].map.call(anchors, a => a.href));

                await downloadPDF(String(url), filename);
            }
        }

        if( nextUrl != null ) {
            await page.goto(String(nextUrl), {
                waitUntil: 'networkidle2',
            });

            pageCounter ++;
        } 
    } while(nextUrl != null);

    console.log("Magazine issue downloaded, closing browser...");
    await browser.close();

    console.log("Joining pages to a single PDF...");
    var files = fs.readdirSync(tmpDir);

    files.forEach((element, index) => {
        files[index] = path.join(tmpDir, element);
    });

    var pdfWriter = hummus.createWriter(outputFile);

    files.forEach((element, index) => {
            pdfWriter.appendPDFPagesFromPDF(files[index]);
    });

    pdfWriter.end();

    fs.rmdirSync(tmpDir, { recursive: true });

    console.log("Done. Please open output.pdf");
}

main();
