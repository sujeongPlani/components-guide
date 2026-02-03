export interface PreviewAsset {
  name: string
  dataUrl: string
}

/**
 * 컴포넌트 CSS 선택자 앞에 #__preview-root 를 붙여 특이성을 높임.
 * KRDS 등 공통 CSS보다 후순위로 적용되도록 함.
 * @media, @keyframes 내부는 그대로 두고, 최상위 규칙만 prefix (중괄호 깊이 + 주석 스킵).
 */
export function scopeComponentCss(css: string): string {
  if (!css.trim()) return css
  let out = ''
  let i = 0
  let depth = 0
  const len = css.length
  while (i < len) {
    const ch = css[i]
    if (ch === '/' && css[i + 1] === '*') {
      out += '/*'
      i += 2
      while (i < len - 1 && (css[i] !== '*' || css[i + 1] !== '/')) {
        out += css[i]
        i++
      }
      if (i < len - 1) {
        out += '*/'
        i += 2
      }
      continue
    }
    if (ch === '/' && css[i + 1] === '/' && depth === 0) {
      while (i < len && css[i] !== '\n') {
        out += css[i]
        i++
      }
      if (i < len) {
        out += css[i]
        i++
      }
      continue
    }
    if (ch === '{') {
      depth++
      out += ch
      i++
      continue
    }
    if (ch === '}') {
      depth--
      out += ch
      i++
      continue
    }
    if (depth === 0 && (ch === '.' || ch === '#' || ch === '[' || (ch && /[a-zA-Z]/.test(ch)))) {
      const start = i
      while (i < len && css[i] !== '{') i++
      const sel = css.slice(start, i).trim()
      if (sel && !sel.startsWith('@')) {
        const prefixed = sel
          .split(',')
          .map((part: string) => `#__preview-root ${part.trim()}`)
          .join(', ')
        out += prefixed
      } else {
        out += css.slice(start, i)
      }
      continue
    }
    out += ch
    i++
  }
  return out
}

/**
 * CSS 내 url(경로/파일명) 을 commonAssets에 있는 파일명이면 data URL로 치환.
 * 미리보기는 실제 파일이 없으므로 상대 경로(../img/icon/ico_flag.svg 등)는 로드되지 않음.
 */
function replaceAssetUrlsInCss(css: string, assetMap: Record<string, string>): string {
  let out = css
  for (const [name, dataUrl] of Object.entries(assetMap)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`url\\s*\\(\\s*['"]?[^)'"]*${escaped}['"]?\\s*\\)`, 'gi')
    const safeUrl = dataUrl.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    out = out.replace(re, () => `url("${safeUrl}")`)
  }
  return out
}

/** CSS 안 </style> 이스케이프 (iframe 문서 깨짐 방지) */
function escapeCssForHtml(css: string): string {
  return (css ?? '').replace(/<\/style\s*>/gi, '</sty\\le>')
}

/** JS 안 </script> 이스케이프 (script 태그 조기 종료 방지) */
function escapeJsForHtml(js: string): string {
  return (js ?? '').replace(/<\/script\s*>/gi, '<\\/script>')
}

/**
 * 단일 컴포넌트용 iframe srcdoc 생성
 * commonCss → 첫 번째 style, componentCss → 두 번째 style (후순위 적용)
 * commonJs → 첫 번째 script, componentJs → 두 번째 script (후순위 실행)
 * assets가 있으면 window.ASSETS, window.getAsset(name) 주입 및 data-asset 자동 치환
 */
export function buildPreviewDocument(
  html: string,
  commonCss: string,
  componentCss: string,
  commonJs: string,
  componentJs: string,
  assets: PreviewAsset[] = []
): string {
  const assetMap =
    assets.length > 0
      ? assets.reduce<Record<string, string>>((acc, a) => {
          acc[a.name] = a.dataUrl
          return acc
        }, {})
      : null

  const resolvedCommonCss =
    assetMap !== null && Object.keys(assetMap).length > 0
      ? replaceAssetUrlsInCss(commonCss ?? '', assetMap)
      : (commonCss ?? '')
  const resolvedComponentCss =
    assetMap !== null && Object.keys(assetMap).length > 0
      ? replaceAssetUrlsInCss(componentCss ?? '', assetMap)
      : (componentCss ?? '')

  const safeCommonCss = escapeCssForHtml(resolvedCommonCss)
  const scopedComponentCss = scopeComponentCss(resolvedComponentCss)
  const safeComponentCss = escapeCssForHtml(scopedComponentCss)
  const safeCommonJs = escapeJsForHtml(commonJs ?? '')
  const safeComponentJs = escapeJsForHtml(componentJs ?? '')

  const assetScript =
    assetMap !== null
      ? `<script>
window.ASSETS = ${JSON.stringify(assetMap)};
window.getAsset = function(name) { return window.ASSETS[name] || ''; };
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('[data-asset]').forEach(function(el) {
    var name = el.getAttribute('data-asset');
    var url = window.getAsset(name);
    if (url && el.tagName === 'IMG') el.src = url;
    if (url && el.style) el.style.backgroundImage = 'url(' + url + ')';
  });
});
<\/script>`
      : ''

  const preventNavigationScript = `<script>
(function() {
  document.addEventListener('click', function(e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (a) { e.preventDefault(); }
  }, true);
  document.addEventListener('submit', function(e) { e.preventDefault(); }, true);
})();
<\/script>`

  const heightReportScript = `<script>
(function() {
  var styleId = 'lg-focus-iframe-measure';
  function injectLayoutStyle() {
    if (document.getElementById(styleId)) return;
    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = 'html, body { height: auto !important; min-height: auto !important; overflow: hidden !important; } #__preview-root { display: block !important; height: auto !important; min-height: auto !important; overflow: visible !important; }';
    (document.head || document.documentElement).appendChild(style);
    document.documentElement.style.cssText = 'overflow: hidden !important; height: auto !important; min-height: auto !important;';
    if (document.body) document.body.style.cssText = 'overflow: hidden !important; height: auto !important; min-height: auto !important;';
  }
  function sendHeight() {
    injectLayoutStyle();
    var root = document.getElementById('__preview-root');
    if (!root) return;
    var doc = document.documentElement;
    var body = document.body;
    var rootH = Math.max(root.scrollHeight || 0, root.offsetHeight || 0);
    var bodyH = body ? Math.max(body.scrollHeight || 0, body.offsetHeight || 0) : 0;
    var docH = doc.scrollHeight || 0;
    var h = Math.max(rootH, bodyH, docH);
    if (h > 0 && window.parent !== window) {
      window.parent.postMessage({ type: 'lg-iframe-height', height: Math.ceil(h) + 2 }, '*');
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendHeight);
  } else {
    sendHeight();
  }
  window.addEventListener('load', sendHeight);
  setTimeout(sendHeight, 200);
  setTimeout(sendHeight, 800);
  if (typeof ResizeObserver !== 'undefined') {
    var ro = document.getElementById('__preview-root');
    if (ro) {
      var roObs = new ResizeObserver(function() { sendHeight(); });
      roObs.observe(ro);
    }
  }
})();
<\/script>`

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style id="lg-preview-common">${safeCommonCss}</style>
  <style id="lg-component-styles">${safeComponentCss}</style>
</head>
<body>
  <div id="__preview-root">${html}
  ${assetScript}
  <script>${safeCommonJs}<\/script>
  <script>${safeComponentJs}<\/script></div>
  ${preventNavigationScript}
  ${heightReportScript}
</body>
</html>`
}
