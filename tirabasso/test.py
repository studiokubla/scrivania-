import asyncio, os, sys
from playwright.async_api import async_playwright
URL='file://'+os.path.abspath('dist/index.html')
SHOTS='/tmp/claude-0/-home-user-scrivania-/ca81940b-9ef1-5336-988c-d10f4312d218/scratchpad/shots'
os.makedirs(SHOTS,exist_ok=True)
errors=[]

async def main():
    async with async_playwright() as pw:
        b=await pw.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':1440,'height':900})
        pg.on('console', lambda m: errors.append('CONSOLE '+m.type+': '+m.text) if m.type=='error' else None)
        pg.on('pageerror', lambda e: errors.append('PAGEERROR: '+str(e)))
        await pg.goto(URL, wait_until='networkidle')
        await pg.wait_for_timeout(1800)

        async def shot(name, full=False):
            await pg.screenshot(path=f'{SHOTS}/{name}.png', full_page=full)

        await shot('01-home-hero')
        # scroll through home
        await pg.evaluate("window.scrollTo(0,document.body.scrollHeight*0.22)"); await pg.wait_for_timeout(900); await shot('02-home-mondi')
        await pg.evaluate("window.scrollTo(0,document.body.scrollHeight*0.42)"); await pg.wait_for_timeout(900); await shot('03-home-prodotti')
        await pg.evaluate("window.scrollTo(0,document.body.scrollHeight*0.62)"); await pg.wait_for_timeout(900); await shot('04-home-savoir')
        await pg.evaluate("window.scrollTo(0,document.body.scrollHeight*0.85)"); await pg.wait_for_timeout(900); await shot('05-home-jackson')

        # PLP
        await pg.goto(URL+'#/collezioni', wait_until='load'); await pg.wait_for_timeout(1200); await shot('06-plp')
        n=await pg.locator('.grid .card').count(); print('PLP cards:',n)
        # filtro
        await pg.click('.chip:has-text("Feltro")'); await pg.wait_for_timeout(900)
        n2=await pg.locator('.grid .card').count(); print('PLP feltro:',n2); await shot('07-plp-feltro')

        # PDP
        await pg.click('.grid .card .card__media'); await pg.wait_for_timeout(1200); await shot('08-pdp')
        title=await pg.locator('.pdp h1').inner_text(); print('PDP:',title)
        # taglia + add
        await pg.click('.size >> nth=3')
        await pg.click('#qPlus')
        await pg.click('#addBtn'); await pg.wait_for_timeout(1100); await shot('09-cart-drawer')
        badge=await pg.locator('#bagN').inner_text(); print('badge:',badge)
        tot=await pg.locator('#cartTot').inner_text(); print('totale:',tot)

        # checkout
        await pg.click('#goCheckout'); await pg.wait_for_timeout(1100); await shot('10-checkout')
        # validazione vuota
        await pg.click('[data-checkout] button[type=submit]'); await pg.wait_for_timeout(500)
        errs=await pg.locator('.field.err').count(); print('campi in errore (attesi >0):',errs)
        await shot('11-checkout-validazione')
        # compila
        for sel,val in [('#cemail','marco@example.com'),('#nome','Marco'),('#cognome','Rossi'),
                        ('#via','Via Roma 1'),('#citta','Milano'),('#cap','20121'),
                        ('#carta','4242 4242 4242 4242'),('#scad','12/29'),('#cvc','123')]:
            await pg.fill(sel,val)
        await pg.click('[data-checkout] button[type=submit]'); await pg.wait_for_timeout(1200)
        print('hash dopo ordine:',await pg.evaluate('location.hash'))
        await shot('12-ordine-ok')
        print('badge dopo ordine:',await pg.locator('#bagN').is_hidden())

        # maison / savoir / jackson
        for route,name in [('#/maison','13-maison'),('#/savoir-faire','14-savoir'),('#/jackson','15-jackson'),('#/contatti','16-contatti')]:
            await pg.goto(URL+route, wait_until='load'); await pg.wait_for_timeout(1400); await shot(name)

        # form b2b
        await pg.goto(URL+'#/jackson', wait_until='load'); await pg.wait_for_timeout(1000)
        await pg.click('[data-b2b] button[type=submit]'); await pg.wait_for_timeout(400)
        print('b2b errori:',await pg.locator('[data-b2b] .field.err').count())
        for sel,val in [('#azienda','Boutique Vela'),('#piva','IT01234567890'),('#ref','Anna Bianchi'),
                        ('#email','anna@boutique.it'),('#paese','Italia')]:
            await pg.fill(sel,val)
        await pg.click('[data-b2b] button[type=submit]'); await pg.wait_for_timeout(800)
        print('b2b inviato:', await pg.locator('[data-b2b] .ok__mark').count()==1)
        await shot('17-b2b-inviato')

        # ricerca
        await pg.goto(URL, wait_until='load'); await pg.wait_for_timeout(800)
        await pg.click('#openSearch'); await pg.wait_for_timeout(500)
        await pg.fill('#sInput','panama'); await pg.wait_for_timeout(700)
        print('risultati panama:', await pg.locator('#sRes .card').count())
        await shot('18-ricerca')

        # mobile
        pg2=await b.new_page(viewport={'width':390,'height':844}, device_scale_factor=2)
        await pg2.goto(URL, wait_until='networkidle'); await pg2.wait_for_timeout(1500)
        await pg2.screenshot(path=f'{SHOTS}/19-mobile-home.png')
        await pg2.click('#burger'); await pg2.wait_for_timeout(700)
        await pg2.screenshot(path=f'{SHOTS}/20-mobile-menu.png')
        await pg2.goto(URL+'#/collezioni', wait_until='load'); await pg2.wait_for_timeout(1200)
        await pg2.screenshot(path=f'{SHOTS}/21-mobile-plp.png')
        # overflow orizzontale?
        ow=await pg2.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth")
        print('overflow orizzontale mobile:', ow)
        await b.close()
    print('--- ERRORI JS ---')
    print('\n'.join(errors) if errors else 'nessuno')

asyncio.run(main())
