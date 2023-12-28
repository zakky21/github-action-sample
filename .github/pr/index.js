const fs = require('fs')
const https = require('https')

function commentPR(todos) {
  const comments = todos.map(({ b, type, lines }) => {
    return `
### ${b}
#### TODOが ${type === '+' ? '追加' : '削除'} されました
\`\`\`
${lines.join('\n')}
\`\`\`
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
    },
    comments: comments
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

## TODOが見つかりました
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
  if (!/^[+-].*(TODO|FIXME)/m.test(str)) return

  const todos = str.split('\n').reduce((a, s) => {
    if (/^---\sa\//.test(s)) {
      a.current.a = s.replace(/^---\sa\//, '')
    } else if (/^\+\+\+\sb\//.test(s)) {
      a.current.b = s.replace(/^\+\+\+\sb\//, '')
    } else if (/^diff --git/.test(s)) { // ファイルの切り替わり
      console.log('sss1', s, a.current.todos)
      a.result.push({ ...a.current }) // XXX: object-copyにしてあげないと上手く動かないっぽい
      a.current = { lines: [], todos: [] }
    } else if (/^@@.*@@/.test(s)) { // 差分ブロックの切り替わり
      console.log('sss2', s, a.current.todos)
      a.result.push({ ...a.current }) // XXX: object-copyにしてあげないと上手く動かないっぽい
      a.current.lines = []
      a.current.todos = []
    } else {
      a.current.lines.push(s)
      if (/^[+-].*(TODO|FIXME)/.test(s)) a.current.todos.push({ index: a.current.lines.length, type: s[0] })
    }
    return a
  }, { current: { lines: [], todos: [] }, result: [] })
  todos.result.push(todos.current)

  commentPR(
    // console.log(
    todos.result.map((r) => {
      return r.todos.map((t) => ({
        a: r.a,
        b: r.b,
        type: t.type,
        lines: r.lines.slice(t.index - 5 < 0 ? 0 : t.index - 5, t.index + 10),
      }))
    }).flat())
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
  // const response = fs.readFileSync('./response.txt').toString()
  console.log('diff----->>>', response)
  await parseDiff(response)
}

Object.keys(process.env).forEach(key => {
  console.log(key, process.env[key])
})
console.log(JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH)))

run()
