const { gray, green, red, bold } = require('kleur');
const moment = require('moment')

var api, owner, repo, silent

class StatusCheck {

	constructor() { }

	static init (app, context, quiet = false) {
    return (async function () {
      let instance = new StatusCheck()
      await instance.build(app, context, quiet)
      return instance
    }())
  } 
  
  async build(app, context, quiet) {
    api    = await app.auth(context.payload.installation.id)
    owner  = context.payload.repository.owner.login
    repo   = context.payload.repository.name
    silent = quiet
  }

	async send(pullRequest, message, status) {
		if(silent) {
			const response = await api.checks.create({
	      owner: owner, 
	      repo: repo, 
	      name: message, 
	      head_sha: pullRequest.head.sha,
	      status: "completed",
	      conclusion: status ? "success" : "failure"
	    })
	    
	    if(response.status >= 200 && response.status < 300) {
	      return true
	    }
	    throw new Error(response)
		}
  		
  	var time = `${moment().format("HH:mm:ss.SSS")}Z`
		console.log(`${gray(time)}  ${status ? green().bold("SUCCESS") : red().bold("ERROR")} ${message}`)
	}
}

module.exports = StatusCheck