// Copies your real photos into public/photos and wires them into backend/story.json.
//   npm run import                 (looks in the "santhiya" folder, two levels above this one)
//   npm run import -- "D:\\my pics"   (or any folder you name)
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

const src = resolve(process.argv[2] ?? '../..')
const dest = resolve('public/photos')
const storyPath = resolve('../backend/story.json')
const OK = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])
const SKIP = new Set(['love-site', 'node_modules', '.git'])

const found = []
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(join(dir, e.name)) }
    else if (OK.has(extname(e.name).toLowerCase())) found.push(join(dir, e.name))
    else if (extname(e.name).toLowerCase() === '.heic') console.warn(`Skipping ${e.name}: browsers can't show HEIC, export it as JPG first.`)
  }
}
if (!existsSync(src)) { console.error('Folder not found:', src); process.exit(1) }
walk(src)
found.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

if (!found.length) {
  console.log(`No photos found in ${src}\nCopy your .jpg/.png files there (or pass a folder) and run again.`)
  process.exit(0)
}

mkdirSync(dest, { recursive: true })
const paths = found.slice(0, 30).map((f, i) => {
  const name = `photo-${String(i + 1).padStart(2, '0')}${extname(f).toLowerCase()}`
  copyFileSync(f, join(dest, name))
  return `/photos/${name}`
})

const captions = ['Where it all began', 'Your smile, my favourite view', 'Butterflies, still', 'Lost in the moment', 'Golden hour, golden you', 'Us, softly', 'Ordinary, perfect days', 'Forever starts here']
const story = JSON.parse(readFileSync(storyPath, 'utf8'))
story.gallery = paths.map((p, i) => ({ src: p, caption: captions[i % captions.length] }))
writeFileSync(storyPath, JSON.stringify(story, null, 2) + '\n')
console.log(`Imported ${paths.length} photos and updated backend/story.json (edit captions there).`)
