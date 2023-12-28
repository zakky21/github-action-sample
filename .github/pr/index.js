const fs = require('fs')
const https = require('https')

function commentPR(todos) {
  const comments = todos.map(({ a, b, lines, todoLines }) => {

    const detail = todoLines.map(({ index, type }) => {
      const l = lines.substring(index - 5 < 0 ? 0 : index - 5, index + 10)
      return `
#### TODOが ${type === '+' ? '追加' : '削除'} されました
\`\`\`
${l.join('\n')}
\`\`\`
      `
    })
    return `
#### ${b}
${detail}
    `
  })

  const { GITHUB_API_URL, INPUT_COMMENT_URL, INPUT_AFTER, INPUT_TOKEN } = process.env
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
commit_id: ${INPUT_AFTER}

### TODOが見つかりました
以下のTODOコメントの内容に問題がないか（このPR内で解消ができないか、後になって理解ができるかなど）を確認してください

${comments}
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
  str.split('\n').forEach((s, i) => {
    if (/^diff --git/.test(s)) {
      if (current.todoLines) todos.push(current)
      current = { lines: [], todoLines: [] }
    } else if (/^---\s/.test(s)) {
      current.a = s.replace(/^---\s/, '')
    } else if (/^\+\+\+\s/.test(s)) {
      current.b = s.replace(/^\+\+\+\s/, '')
    } else if (/^@@.*@@/.test(s)) {
      if (current.todoLines) todos.push(current)
    } else {
      if (/^[+-].*(TODO|FIXME)/.test(s)) {
        current.todoLines.push({ index: i, type: s[0] })
      }
    }
    current.lines.push(s)
  })
  if (current.todoLines) todos.push(current)
  if (todos.length) await commentPR(todos)
}

function getDiff() {
  const { GITHUB_API_URL, GITHUB_REPOSITORY, INPUT_BEFORE, INPUT_AFTER, INPUT_TOKEN } = process.env
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: GITHUB_API_URL.replace("https://", ""),
      path: `/repos/${GITHUB_REPOSITORY}/compare/${INPUT_BEFORE}...${INPUT_AFTER}`,
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
