const automerge = require("./lib/automerge.js")
const appId = require("./lib/id.js")

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = app => {
  // Your code here
  app.log('Yay, the app was loaded!')

  app.on([
    'pull_request.opened', 
    'pull_request.reopened', 
    'pull_request.labeled', 
    'pull_request.edited', 
    'pull_request.ready_for_review'], async context => await automerge.run(context) )

  app.on([
    'check_run.created',
    'check_run.completed'], async context => { 
      if(context.payload.check_run.check_suite.app.id === appId()) {
        return
      }
      
      await automerge.run(context) 
    })
}
