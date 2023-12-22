// const { Toolkit } = require('actions-toolkit')
const fs = require('fs')
const https = require('https')

// console.log("start scripts")
// Object.keys(process.env).forEach(key => {
//   console.log(key, process.env[key])
// })

// console.log("read file...>>>>")
// console.log(JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH)))

// const { GITHUB_API_URL, GITHUB_REPOSITORY, GITHUB_BASE_REF, GITHUB_HEAD_REF, INPUT_TOKEN } = process.env
// console.log({
//   hostname: GITHUB_API_URL,
//   path: `/repos/${GITHUB_REPOSITORY}/compare/${GITHUB_BASE_REF}...${GITHUB_HEAD_REF}`,
// })

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
  console.log("response", response)
}

run()
// callAPI()