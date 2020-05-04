const { gray, green, yellow, red, bold, underline } = require('kleur');
const AutoMerge = require("./lib/automerge.js")
const appId = require("./lib/id.js")
const moment = require('moment')
const delay = require('delay');

const reviewers = ["rosie", "bender", "wall-e"]

module.exports = app => {

  var time = `${moment().format("HH:mm:ss.SSS")}Z`
  console.log(`${gray(time)}  ${green().bold("SUCCESS")} - ${underline().bold("Frank Merges")} was loaded!`)

  app.on([
    'pull_request.opened', 
    'pull_request.reopened', 
    'pull_request.labeled', 
    'pull_request.edited', 
    'pull_request.ready_for_review'], async context => {

    const autoMerge = await AutoMerge.init(app, context)
    const pullRequest = context.payload.pull_request

    autoMerge
      .run(pullRequest)
      .catch(e => { 
        requestApprovals(pullRequest, reviewersBots(e.message))
      })
  })

  app.on([
    'pull_request_review.submitted'], async context => {

      await delay(2000)

      const autoMerge = await AutoMerge.init(app, context)
      
      autoMerge
        .run(context.payload.pull_request)
        .catch(e => console.log(`${gray(time)}  ${red().bold("ERROR")} - ${e}`))
  })

  app.on([
    'check_run.created',
    'check_run.completed',
    'check_run.rerequested',
    'check_run.requested_action'], async context => { 
      if(context.payload.check_run.check_suite.app.id === appId()) {
        return
      }
      
      const pullRequests = await Promise.all(context.payload.check_run.pull_requests.map(async pullRequest => {
        return context.github.pulls.get({
          owner: context.payload.repository.owner.login,
          repo: context.payload.repository.name,
          pull_number: pullRequest.number
        })
      }))

    const autoMerge = await AutoMerge.init(app, context)
    
    autoMerge
      .enqueue(pullRequests.map(pullRequest => pullRequest.data))
      .catch(e => { 
        requestApprovals(pullRequest, reviewersBots(e.message))
      })
  })

  function requestApprovals(pullRequest, bots) {
    autoMerge
      .getApprovedReviews(pullRequest)
      .then(reviews => { 
        
        if(reviews.length == 0) {
          console.log(`${gray(time)}  ${yellow().bold("WARNING")} - Missing reviewers approvals. Asking for help...`)

          autoMerge
            .requestReview(pullRequest)
            .then(autoMerge.approvePullRequest(pullRequest))
            .then(console.log(`${gray(time)}  ${green().bold("SUCCESS")} - ${bold("Frank")} approved!`))
            .then(autoMerge.callReviewersBots(bots, pullRequest))
            .then(console.log(`${gray(time)}  ${green().bold("SUCCESS")} - ${bold(bots.join(", "))} was/were requested`))
            .catch(e => console.log(`${gray(time)}  ${red().bold("ERROR")} - ${e}`))
        }
      })
      .catch(e => console.log(`${gray(time)}  ${red().bold("ERROR")} - ${e}`))
  }

  function reviewersBots(error_message) {
    const matches = error_message.match(/least (\d[\d+]?) approving reviews/is)

    const choseReviewers = []
    if(matches != null && matches.length > 0) {
        for(var i = 0; i < matches[1]; i++) {
          const index = Math.floor(Math.random() * reviewers.length)
          choseReviewers.push(`**@${reviewers[index]}-reviewer**`)
          reviewers.splice(index, 1)
        }
    }

    return choseReviewers        
  }
}
