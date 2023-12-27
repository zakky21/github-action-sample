const https = require('https')

function commentPR({ a, b, lines }) {
  console.log(a, b, lines)
  const { GITHUB_API_URL, pull_request: { comments_url } } = process.env
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: GITHUB_API_URL.replace("https://", ""),
      path: comments_url.replace(GITHUB_API_URL, ''),
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3.diff',
        Authorization: `token ${INPUT_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'YourApp',
      },
      timeout: 5000
    }, res => {
      let chunks = []
      res.on('data', chunk => { chunks.push(chunk) })
      res.on('end', () => resolve(Buffer.concat(chunks).toString()))
      res.on('error', err => { reject(err) })
    })
    req.on('timeout', () => {
      console.log('timeout')
      req.destroy()
      reject(Error('timeout'))
    })
    req.on('error', (e) => { reject(e) })
    req.end(`
      ### TODOが見つかりました
      以下のTODOコメントの内容に問題がないか（このPR内で解消ができないか、後になって理解ができるか）を確認してください

      FILE:
      from: ${a}
      to: ${b}
      \`\`\`
      ${lines.join('\n')}
      \`\`\`
    `)
  })
}

function parseDiff(str) {
  if (!/^\+.*(TODO|FIXME)/m.test(str)) return

  let current = {};
  str.split('\n').forEach(s => {
    if (/^diff --git/.test(s)) {
      if (current.found) commentPR(current)
      current = { lines: [] }
    } else if (/^---/.test(s)) {
      current.a = s
    } else if (/^\+\+\+/.test(s)) {
      current.b = s
    } else if (/^@@.*@@/.test(s)) {
      if (current.found) commentPR(current)
      current.lines = [s]
    } else {
      if (/^\+.*(TODO|FIXME)/.test(s)) {
        current.found = true
      }
      current.lines.push(s)
    }
  })
  if (current.found) commentPR(current)
}

function getDiff() {
  const { GITHUB_API_URL, GITHUB_REPOSITORY, GITHUB_BASE_REF, GITHUB_HEAD_REF, INPUT_TOKEN } = process.env
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: GITHUB_API_URL.replace("https://", ""),
      path: `/repos/${GITHUB_REPOSITORY}/compare/${GITHUB_BASE_REF}...${GITHUB_HEAD_REF}`,
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github.v3.diff',
        Authorization: `token ${INPUT_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'YourApp',
      },
      timeout: 5000
    }, res => {
      let chunks = []
      res.on('data', chunk => { chunks.push(chunk) })
      res.on('end', () => resolve(Buffer.concat(chunks).toString()))
      res.on('error', err => { reject(err) })
    })
    req.on('timeout', () => {
      console.log('timeout')
      req.destroy()
      reject(Error('timeout'))
    })
    req.on('error', (e) => { reject(e) })
    req.end()
  })
}

async function run() {
  const response = await getDiff()
  parseDiff(response)
}

run()
