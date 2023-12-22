const { Toolkit } = require('actions-toolkit');
const fs = require('fs')
const https = require('https')

console.log("start scripts")
Object.keys(process.env).forEach(key => {
  console.log(key, process.env[key])
})

console.log("read file...>>>>")
console.log(JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH)))

const { GITHUB_API_URL, GITHUB_REPOSITORY, GITHUB_BASE_REF, GITHUB_HEAD_REF, INPUT_TOKEN } = process.env
// const req = https.request(
console.log({
  hostname: GITHUB_API_URL,
  path: `repo/${GITHUB_REPOSITORY}/compare/${GITHUB_BASE_REF}...${GITHUB_HEAD_REF}`,
})

function get() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: GITHUB_API_URL,
      path: `repo/${GITHUB_REPOSITORY}/compare/${GITHUB_BASE_REF}...${GITHUB_HEAD_REF}`,
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github.v3.diff',
        Authorization: `token ${INPUT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 5000
    }, res => {
      let chunks = [];
      res.on('data', chunk => { chunks.push(chunk); })
      res.on('end', () => {
        const resb = Buffer.concat(chunks).toString();
        try {
          console.log("response", resb)
          const json = JSON.parse(resb);
          console.log("response-json", json)
          resolve(json);
        } catch (e) {
          console.error(e);
          reject(e);
        }
      });
      res.on('error', err => reject(err))
    });
    req.on('timeout', () => {
      req.destroy();
      reject(Error('timeout'));
    })
    req.on('error', () => { })
    req.end();
  })
}

Toolkit.run(async tools => {
  const response = await get()
  console.log("response", response)
})

// async function callAPI() {
//   const response = await get()
//   console.log("response", response)
// }

// callAPI()