const fs = require('fs')

console.log("start scripts")
Object.keys(process.env).forEach(key => {
  // console.log(key, process.env[key])
})

console.log("read file...>>>>")
console.log(JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH)))
