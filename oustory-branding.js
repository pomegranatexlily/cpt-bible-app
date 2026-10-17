(() => {
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
  icon.src = 'assets/covenant-bible-gold-512.png';
  icon.alt = 'Covenant Bible gold book icon with POM × LILY seal';
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
  const actions = [
    ['Read the Bible', () => window.OustoryFeatures?.show('bible')],
    ['Books & chapters', () => document.querySelector('button[data-panel="books-panel"]').click()],
    ['Search Scripture', () => document.querySelector('button[data-panel="search-panel"]').click()],
    ['Saved places', () => window.OustoryReader?.openSaved()],
    ['Reading settings', () => document.getElementById('settings-panel')?.showModal()],
    ['About this edition', () => document.querySelector('button[data-panel="edition-panel"]').click()]
  ];
  actions.forEach(([label, action]) => {
    const button = document.createElement('button');
    button.className = 'oustory-menu-row';
    button.textContent = label;
    button.onclick = () => { menu.close(); action(); };
    menu.append(button);
  });
  document.body.append(menu);
  opener.onclick = () => menu.showModal();
  const edition = document.getElementById('edition-panel');
  if (edition) {
    const editionIcon = icon.cloneNode(true);
    editionIcon.className = 'oustory-edition-icon';
    edition.querySelector('.sheet-header').after(editionIcon);
  }
})();
