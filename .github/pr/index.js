const fs = require('fs')

console.log("start scripts")
Object.keys(process.env).forEach(key => {
  console.log(key, process.env[key])
})

console.log(fs.readFileSync(process.env.GITHUB_EVENT_PATH))