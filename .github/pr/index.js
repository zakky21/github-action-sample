const fs = require('fs')
const https = require('https')

function commentPR(todos) {
  const comments = todos.map(({ a, b, lines }) => {
    return `
      #### ${b}
      file: ${a} -> ${b}
      \`\`\`
      ${lines.join('\n')}
      \`\`\`

    `
  })

  const { GITHUB_API_URL, INPUT_COMMENT_URL, GITHUB_SHA, INPUT_TOKEN } = process.env
  console.log({
    hostname: GITHUB_API_URL.replace("https://", ""),
    path: INPUT_COMMENT_URL.replace(GITHUB_API_URL, ''),
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github+json',
      Authorization: `token ${INPUT_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'YourApp',
    }
  })
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: GITHUB_API_URL.replace("https://", ""),
      path: INPUT_COMMENT_URL.replace(GITHUB_API_URL, ''),
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
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
    req.write(JSON.stringify({
      body: `
      \`\`\`
      ${GITHUB_SHA}
      ### TODOが見つかりました
      以下のTODOコメントの内容に問題がないか（このPR内で解消ができないか、後になって理解ができるか）を確認してください

      ${comments}
      \`\`\`
    `}))
    req.on('timeout', () => {
      console.log('timeout')
      req.destroy()
      reject(Error('timeout'))
    })
    req.on('error', (e) => { reject(e) })
    req.end()
  })
}

async function parseDiff(str) {
  if (!/^\+.*(TODO|FIXME)/m.test(str)) return

  const todos = []
  let current = {};
  str.split('\n').forEach(s => {
    if (/^diff --git/.test(s)) {
      if (current.found) todos.push(current)
      current = { lines: [] }
    } else if (/^---/.test(s)) {
      current.a = s
    } else if (/^\+\+\+/.test(s)) {
      current.b = s
    } else if (/^@@.*@@/.test(s)) {
      if (current.found) todos.push(current)
      current.lines = [s]
    } else {
      if (/^\+.*(TODO|FIXME)/.test(s)) {
        current.found = true
      }
      current.lines.push(s)
    }
  })
  if (current.found) todos.push(current)
  if (todos.length) await commentPR(todos)
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
  await parseDiff(response)
}

Object.keys(process.env).forEach(key => {
  console.log(key, process.env[key])
})
console.log(JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH)))

run()
