console.log("start scripts")
Object.keys(process.env).forEach(key => {
  console.log(key, process.env[key])
})
