
(function(){
  'use strict';

  function setupMenu(menu){
    if(!menu || menu.dataset.skMenuReady === '1') return;
    var btn = menu.querySelector(':scope > button');
    var ul = menu.querySelector(':scope > ul');
    if(!btn || !ul) return;

    var items = Array.prototype.slice.call(ul.children || []);
    items.forEach(function(li){
      var a = li.querySelector && li.querySelector('a');
      if(!a || !a.textContent || !a.textContent.trim()) {
        li.remove();
      }
    });

    menu.dataset.skMenuReady = '1';
    menu.classList.add('sk-local-menu');

    if(!ul.id){
      ul.id = 'sk-menu-' + Math.random().toString(36).slice(2, 10);
    }
    btn.setAttribute('aria-controls', ul.id);
    btn.setAttribute('aria-expanded', 'false');

    function setOpen(open){
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.classList.toggle('sk-menu-open', open);
      menu.classList.toggle('sk-menu-closed', !open);
      ul.style.display = open ? 'block' : 'none';

      var icon = btn.querySelector('.expicon');
      if(icon){
        icon.classList.toggle('glyphicon-chevron-down', !open);
        icon.classList.toggle('glyphicon-chevron-up', open);
      }
    }

    setOpen(false);

    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      var open = btn.getAttribute('aria-expanded') === 'true';
      setOpen(!open);
    }, true);

    ul.addEventListener('click', function(e){
      e.stopPropagation();
    });

    document.addEventListener('click', function(){
      if(btn.getAttribute('aria-expanded') === 'true') setOpen(false);
    });

    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true'){
        setOpen(false);
        btn.focus();
      }
    });
  }

  function initMenus(){
    document.querySelectorAll('.gcweb-menu').forEach(setupMenu);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initMenus);
  }else{
    initMenus();
  }

  // WET/GCWeb may alter menu markup after DOM ready, so re-assert the fallback once.
  setTimeout(initMenus, 750);
})();
