const https = require('https')

// PRにコメントする
function commentPR(todos) {
  const comments = todos.map(({ b, type, lines }) => `
### ${b}
#### TODOが ${type === '+' ? '追加' : '削除'} されました
\`\`\`
${lines.join('\n')}
\`\`\``).join('\n')

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

// diff（unified形式）からTODOを抽出する
// NOTE: https://www.gnu.org/software/diffutils/manual/diffutils.html#Unified-Format
async function parseDiff(str) {
  const { INPUT_INDEX_BEFORE, INPUT_INDEX_AFTER, INPUT_IDENTIFIERS } = process.env
  if (!/^[+-].*(TODO|FIXME)/m.test(str)) return

  const todos = str.split('\n').reduce((a, s) => {
    if (/^---\sa\//.test(s)) {
      // BEFORE側のファイル名（使ってないが一応取ってる）
      a.current.a = s.replace(/^---\sa\//, '')
    } else if (/^\+\+\+\sb\//.test(s)) {
      // AFTER側のファイル名
      a.current.b = s.replace(/^\+\+\+\sb\//, '')
    } else if (/^diff --git/.test(s)) { // ファイルの切り替わり
      console.log('sss1', s, a.current.todos)
      a.result.push({ ...a.current })
      a.current = { lines: [], todos: [] }
    } else if (/^@@.*@@/.test(s)) { // 差分ブロックの切り替わり
      console.log('sss2', s, a.current.todos)
      a.result.push({ ...a.current })
      a.current.lines = []
      a.current.todos = []
    } else {
      a.current.lines.push(s)
      if (new RegExp(`^[+-].*(${INPUT_IDENTIFIERS})`).test(s)) a.current.todos.push({ index: a.current.lines.length, type: s[0] })
    }
    return a
  }, { current: { lines: [], todos: [] }, result: [] })
  todos.result.push(todos.current)

  commentPR(
    todos.result.map((r) => {
      return r.todos.map((t) => ({
        a: r.a,
        b: r.b,
        type: t.type,
        lines: r.lines.slice(t.index - INPUT_INDEX_BEFORE < 0 ? 0 : t.index - INPUT_INDEX_BEFORE, t.index + INPUT_INDEX_AFTER),
      }))
    }).flat())
}

// 直前のCI実行からのコード差分を取得
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

run()
