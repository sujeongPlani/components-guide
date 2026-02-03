/**
 * KRDS 폴더(css, js, img)를 읽어 프로젝트 JSON 생성.
 * 사용: node scripts/build-krds-project.js [KRDS폴더경로] [출력JSON경로]
 * 예: node scripts/build-krds-project.js "C:\\Users\\plani\\Desktop\\KRDS\\krds" "public\\krds-project.json"
 */
const fs = require('fs')
const path = require('path')

const KRDS_ROOT = process.argv[2] || path.join(process.env.USERPROFILE || '', 'Desktop', 'KRDS', 'krds')
const OUT_PATH = process.argv[3] || path.join(__dirname, '..', 'public', 'krds-project.json')

function id() {
  return 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const IMAGE_EXT = new Set(['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico'])
const MIME = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

function buildFileTree(dir, relativeDir = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const nodes = []
  for (const e of entries) {
    const full = path.join(dir, e.name)
    const rel = relativeDir ? path.join(relativeDir, e.name) : e.name
    if (e.isDirectory()) {
      const children = buildFileTree(full, rel)
      nodes.push({ id: id(), name: e.name, type: 'folder', children })
    } else {
      nodes.push({ id: id(), name: e.name, type: 'file', children: undefined })
    }
  }
  return nodes.sort((a, b) => (a.type === 'folder' && b.type === 'file' ? -1 : a.type === b.type ? a.name.localeCompare(b.name) : 1))
}

function collectImagePaths(dir, baseDir, list = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    const rel = path.relative(baseDir, full).replace(/\\/g, '/')
    if (e.isDirectory()) {
      collectImagePaths(full, baseDir, list)
    } else if (IMAGE_EXT.has(path.extname(e.name).toLowerCase())) {
      list.push({ path: full, name: e.name, rel })
    }
  }
  return list
}

function main() {
  if (!fs.existsSync(KRDS_ROOT)) {
    console.error('KRDS 폴더가 없습니다:', KRDS_ROOT)
    process.exit(1)
  }

  const commonFiles = []
  const cssDir = path.join(KRDS_ROOT, 'css')
  const jsDir = path.join(KRDS_ROOT, 'js')

  if (fs.existsSync(cssDir)) {
    for (const name of ['krds_tokens.css', 'krds.css', 'mixin.css', 'krds_respond.css']) {
      const f = path.join(cssDir, name)
      if (fs.existsSync(f)) {
        const content = fs.readFileSync(f, 'utf-8')
        commonFiles.push({ id: id(), name, content, type: 'css' })
      }
    }
  }
  if (fs.existsSync(jsDir)) {
    for (const name of ['pattern.js', 'krds.min.js']) {
      const f = path.join(jsDir, name)
      if (fs.existsSync(f)) {
        const content = fs.readFileSync(f, 'utf-8')
        commonFiles.push({ id: id(), name, content, type: 'js' })
      }
    }
  }

  const commonAssets = []
  const imgDir = path.join(KRDS_ROOT, 'img')
  if (fs.existsSync(imgDir)) {
    const imageList = collectImagePaths(imgDir, imgDir)
    for (const { path: filePath, name, rel } of imageList) {
      const buf = fs.readFileSync(filePath)
      const ext = path.extname(name).toLowerCase()
      const mime = MIME[ext] || 'application/octet-stream'
      const base64 = buf.toString('base64')
      const dataUrl = `data:${mime};base64,${base64}`
      commonAssets.push({ id: id(), name: rel.replace(/\//g, '_'), dataUrl })
    }
  }

  const fileTree = buildFileTree(KRDS_ROOT)

  const project = {
    name: 'KRDS',
    commonFiles,
    commonAssets,
    fileTree,
    categories: ['Button', 'Form', 'Card', 'Layout', 'Navigation', 'Modal', 'Table', 'Typography', 'Etc'],
  }

  const outDir = path.dirname(OUT_PATH)
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify(project, null, 2), 'utf-8')
  console.log('생성 완료:', OUT_PATH)
  console.log('  commonFiles:', project.commonFiles.length)
  console.log('  commonAssets:', project.commonAssets.length)
}

main()
