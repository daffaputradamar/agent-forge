/* Lightweight embed script for Agent Forge */
(function(){
  const SCRIPT = document.currentScript;
  if(!SCRIPT){return;}
  const publicKey = SCRIPT.getAttribute('data-agent-key');
  if(!publicKey){console.error('[AgentForge] Missing data-agent-key');return;}
  const theme = SCRIPT.getAttribute('data-theme') || 'light';
  const base = SCRIPT.getAttribute('data-base-url') || window.location.origin;
  const position = SCRIPT.getAttribute('data-position') || 'bottom-right';
  const buttonText = SCRIPT.getAttribute('data-button-text') || 'Chat';
  const iframeUrl = base + '/embed/widget?key=' + encodeURIComponent(publicKey) + '&theme=' + encodeURIComponent(theme);

  const container = document.createElement('div');
  container.style.position='fixed';
  container.style.zIndex='999999';
  container.style[ position.startsWith('bottom') ? 'bottom':'top'] = '20px';
  container.style[ position.endsWith('right') ? 'right':'left'] = '20px';

  // 🎨 Theme styles (orange brand)
  const isDark = theme === 'dark';
  const btnBg = isDark ? '#ea580c' : '#f97316';   // orange-600 vs orange-500
  const btnColor = '#fff';
  const frameBg = isDark ? '#0b1220' : '#fff';
  const frameBorder = isDark ? '#1f2937' : '#e5e7eb';

  const btn = document.createElement('button');
  btn.textContent = buttonText;
  btn.style.background= btnBg;
  btn.style.color= btnColor;
  btn.style.border='none';
  btn.style.borderRadius='999px';
  btn.style.padding='10px 18px';
  btn.style.fontFamily='system-ui,sans-serif';
  btn.style.cursor='pointer';
  btn.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)';

  const frameWrapper = document.createElement('div');
  frameWrapper.style.position='fixed';
  frameWrapper.style.display='none';
  frameWrapper.style.flexDirection='column';
  frameWrapper.style.width='380px';
  frameWrapper.style.maxWidth='90vw';
  frameWrapper.style.height='560px';
  frameWrapper.style.maxHeight='80vh';
  frameWrapper.style.background= frameBg;
  frameWrapper.style.border='1px solid ' + frameBorder;
  frameWrapper.style.borderRadius='16px';
  frameWrapper.style.overflow='hidden';
  frameWrapper.style.boxShadow='0 10px 40px -5px rgba(0,0,0,0.25)';
  frameWrapper.style[ position.startsWith('bottom') ? 'bottom':'top'] = '80px';
  frameWrapper.style[ position.endsWith('right') ? 'right':'left'] = '20px';

  const iframe = document.createElement('iframe');
  iframe.src = iframeUrl;
  iframe.style.width='100%';
  iframe.style.height='100%';
  iframe.style.border='0';
  iframe.allow='clipboard-write';

  btn.onclick = () => { 
    frameWrapper.style.display= frameWrapper.style.display==='none' ? 'flex' : 'none'; 
  };

  frameWrapper.appendChild(iframe);
  container.appendChild(btn);
  document.body.appendChild(container);
  document.body.appendChild(frameWrapper);

  window.addEventListener('message', (ev) => {
    if(!iframe.contentWindow || ev.source !== iframe.contentWindow) return;
    if(!ev.data) return;
    if(ev.data.type === 'agentforge:resize'){
      const h = Math.min(parseInt(ev.data.height||'560',10), window.innerHeight-40);
      frameWrapper.style.height = h + 'px';
    }
    if(ev.data.type === 'agentforge:close'){
      frameWrapper.style.display = 'none';
    }
  });
})();
