(() => {
  try { if (localStorage.getItem('oustory.spatial') === '1') document.documentElement.classList.add('spatial-on'); } catch {}
  const settingsButton = document.querySelector('button[data-panel="settings-panel"]');
  if (!settingsButton || document.getElementById('oustory-menu')) return;
  const opener = settingsButton.cloneNode(true);
  opener.removeAttribute('data-panel');
  opener.setAttribute('aria-label', 'Open Oustory menu');
  settingsButton.replaceWith(opener);
  const menu = document.createElement('dialog');
  menu.id = 'oustory-menu';
  menu.setAttribute('aria-labelledby', 'oustory-menu-title');
  const heading = document.createElement('div');
  heading.className = 'oustory-menu-heading';
  const title = document.createElement('h2');
  title.id = 'oustory-menu-title';
  title.textContent = 'Your Bible';
  const close = document.createElement('button');
  close.className = 'icon-button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close menu');
  close.onclick = () => menu.close();
  heading.append(title, close);
  const brand = document.createElement('div');
  brand.className = 'oustory-menu-brand';
  const icon = document.createElement('img');
  icon.src = 'assets/oustory-poster-icon-512.png';
  icon.alt = 'Oustory black leather Bible with a gold tree growing from an open book';
  icon.width = 76;
  icon.height = 76;
  const identity = document.createElement('div');
  const name = document.createElement('h3');
  name.textContent = 'Oustory';
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Covenant Bible · Our Story';
  identity.append(name, subtitle);
  brand.append(icon, identity);
  menu.append(heading, brand);
  // Browsers decide whether installing a PWA can be automated. iOS Safari
  // does not expose an Add to Home Screen API, so show accurate native steps.
  let installEvent=null;
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    installEvent=event;
  });
  const installDialog=document.createElement('dialog');
  installDialog.id='oustory-install-panel';
  installDialog.setAttribute('aria-labelledby','oustory-install-title');
  const installTitle=document.createElement('h2');
  installTitle.id='oustory-install-title';
  installTitle.textContent='Add Oustory to your Home Screen';
  const explanation=document.createElement('p');
  explanation.id='oustory-install-instructions';
  const status=document.createElement('p');
  status.id='oustory-install-status';
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  const installTools=document.createElement('div');
  installTools.className='oustory-install-tools';
  const linkCopy=document.createElement('button');
  linkCopy.type='button';
  linkCopy.className='feature-action';
  linkCopy.textContent='Copy app link';
  linkCopy.onclick=async()=>{
    const appUrl=new URL('./',location.href).href;
    try{
      if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
      await navigator.clipboard.writeText(appUrl);
      status.textContent='Oustory link copied. Open it in Safari to add the app.';
    }catch{
      status.textContent='Copy is unavailable. Open this address in Safari: '+appUrl;
    }
  };
  const dismiss=document.createElement('button');
  dismiss.type='button';
  dismiss.className='feature-action';
  dismiss.textContent='Close';
  dismiss.onclick=()=>installDialog.close();
  installTools.append(linkCopy,dismiss);
  installDialog.append(installTitle,explanation,status,installTools);
  document.body.append(installDialog);
  const installed=()=>window.matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone===true;
  async function showInstall(){
    if(installed()){
      explanation.textContent='Oustory is already running as an installed app on this device.';
      status.textContent='';
      linkCopy.hidden=true;
      installDialog.showModal();
      return;
    }
    if(installEvent){
      const prompt=installEvent;
      installEvent=null;
      try{
        await prompt.prompt();
        const choice=await prompt.userChoice;
        if(choice?.outcome==='accepted')return;
      }catch{ /* Use browser steps below if native installation is unavailable. */ }
    }
    linkCopy.hidden=false;
    const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||
      (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    explanation.textContent=isIOS?
      'On iPhone: open Oustory in Safari, tap Safari’s Share icon, choose Add to Home Screen, then tap Add. If you are viewing Oustory inside ChatGPT or another app, open the link in Safari first.':
      'Open Oustory in your browser, open its menu, and choose Install app or Add to Home Screen. Availability depends on the browser.';
    status.textContent='';
    installDialog.showModal();
  }
  const actions = [
    ['Read the Bible', () => window.OustoryFeatures?.show('bible')],
    ['Books & chapters', () => document.querySelector('button[data-panel="books-panel"]').click()],
    ['Search Scripture', () => document.querySelector('button[data-panel="search-panel"]').click()],
    ['Saved places', () => window.OustoryReader?.openSaved()],
    ['Archive', () => location.assign(new URL('./archive.html',location.href).href)],
    ['Spatial view', () => {
      const on = document.documentElement.classList.toggle('spatial-on');
      try { localStorage.setItem('oustory.spatial', on ? '1' : '0'); } catch {}
      menu.close();
    }],
    ['Add to Home Screen', showInstall],
    ['Reading settings', () => document.getElementById('settings-panel')?.showModal()],
    ['Privacy & data', () => location.assign(new URL('./privacy.html',location.href).href)],
    ['About this edition', () => document.querySelector('button[data-panel="edition-panel"]').click()]
  ];
  actions.forEach(([label, action]) => {
    const button = document.createElement('button');
    button.className = 'oustory-menu-row';
    button.textContent = label;
    button.onclick = () => { menu.close(); action(); };
    menu.append(button);
  });
  // Publisher-confirmed Amazon hardcover Volume I and Volume II listings.
  const printedBibles = [
    ['Buy Oustory Covenant Bible · Volume I — The Law, Writings & Prophets', 'https://a.co/d/0fkMW9qz', 'https://pomegranatexlily.github.io/freedom-arkives/assets/covers/oustory-covenant-bible-volume-i.webp'],
    ['Buy Oustory Covenant Bible · Volume II — The Prophetic, Historical, & Wisdom Writings', 'https://a.co/d/09jGa0jc', 'https://pomegranatexlily.github.io/freedom-arkives/assets/covers/oustory-covenant-bible-volume-ii.webp']
  ];
  const privacyRow = [...menu.querySelectorAll('.oustory-menu-row')].find(row => row.textContent === 'Privacy & data');
  printedBibles.forEach(([label,url]) => {
    const link = document.createElement('a');
    link.className = 'oustory-menu-row';
    link.textContent = label;
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.textDecoration = 'none';
    menu.insertBefore(link, privacyRow || null);
  });
  document.body.append(menu);
  // Show the print PDF only after an actual PDF is published to this repository.
  // Either the short release filename or the supplied KDP filename is accepted.
  (async()=>{
    for(const filename of [
      'oustory-complete-80-book-2026.pdf',
      'OUSTORY_COMPLETE_80_BOOK_KDP_SINGLE_HARDCOVER_TRUE_TWO_COLUMN.pdf'
    ]){
      const pdfUrl=new URL('./assets/'+filename,location.href);
      try{
        const response=await fetch(pdfUrl,{method:'HEAD',cache:'no-store'});
        if(!response.ok||!(response.headers.get('content-type')||'').toLowerCase().startsWith('application/pdf'))continue;
        const link=document.createElement('a');
        link.className='oustory-menu-row';
        link.href=pdfUrl.href;
        link.textContent='Read complete 80-book PDF';
        link.target='_blank';link.rel='noopener noreferrer';
        const rows=[...menu.querySelectorAll('.oustory-menu-row')];
        menu.insertBefore(link,rows[4]||null);
        break;
      }catch{}
    }
  })();
  opener.onclick = () => menu.showModal();
  const edition = document.getElementById('edition-panel');
  if (edition) {
    // A long About sheet can be scrolled past its initial Close button.
    // Give touch users a second escape by tapping the dimmed backdrop.
    edition.addEventListener('click', (event) => {
      if (event.target !== edition) return;
      const box = edition.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right ||
          event.clientY < box.top || event.clientY > box.bottom) {
        edition.close();
      }
    });
    // A reopened sheet should always show its title and Close button.
    edition.addEventListener('close', () => { edition.scrollTop = 0; });
    const editionIcon = icon.cloneNode(true);
    editionIcon.className = 'oustory-edition-icon';
    edition.querySelector('.sheet-header').after(editionIcon);
    const shop = document.createElement('section');
    shop.setAttribute('aria-label', 'Order the Oustory Covenant Bible in print');
    const shopTitle = document.createElement('h3');
    shopTitle.textContent = 'Order the printed Bible';
    shop.append(shopTitle);
    printedBibles.forEach(([label,url,cover]) => {
      const link = document.createElement('a');
      link.className = 'oustory-menu-row';
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.cssText = 'text-decoration:none;display:flex;align-items:center;gap:14px;white-space:normal;';
      const img = document.createElement('img');
      img.src = cover;
      img.alt = '';
      img.width = 64;
      img.height = 86;
      img.loading = 'lazy';
      img.style.cssText = 'width:64px;height:86px;object-fit:cover;border-radius:3px;flex:none;';
      const text = document.createElement('span');
      text.textContent = label;
      link.append(img,text);
      shop.append(link);
    });
    edition.append(shop);
  }
})();
