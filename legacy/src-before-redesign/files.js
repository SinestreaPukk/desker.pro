// Reads a chosen file into what the server accepts: { text } for text files, or { name, mediaType, data } (base64) for photos and PDFs.
const TEXT_FILE = /\.(txt|md|markdown|csv|json|ics)$/i
export async function encodeFile(file) {
  if (file.type.startsWith('text/') || TEXT_FILE.test(file.name)) return { text: await file.text() }
  if (file.type.startsWith('image/')) {
    const bmp = await createImageBitmap(file).catch(() => { throw new Error('This photo format is not supported. Try JPEG or PNG.') })
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) })
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    return { name: file.name, mediaType: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.85).split(',')[1] }
  }
  if (file.type === 'application/pdf') {
    if (file.size > 3e6) throw new Error('That PDF is over 3 MB')
    const data = await new Promise((ok, no) => { const f = new FileReader(); f.onload = () => ok(f.result.split(',')[1]); f.onerror = no; f.readAsDataURL(file) })
    return { name: file.name, mediaType: 'application/pdf', data }
  }
  throw new Error('Supported: photos, PDFs, text files')
}
