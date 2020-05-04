const { gray, green, red, bold, underline } = require('kleur');
const moment = require('moment')

module.exports = app => {

  var time = `${moment().format("HH:mm:ss.SSS")}Z`
  console.log(`${gray(time)}  ${green().bold("SUCCESS")} - ${underline().bold("Bender Reviewer")} was loaded!`)

  app.on(['pull_request_review.submitted'], async context => {
      
    if(context.payload.review.body != null && context.payload.review.body.match(/@bender-reviewer/ig)) {
      
      context.github.pulls.createReview({
        owner: context.payload.pull_request.base.repo.owner.login, 
        repo: context.payload.pull_request.base.repo.name, 
        pull_number: context.payload.pull_request.number,
        event: "APPROVE"
      })
        .then(console.log(`${gray(time)}  ${green().bold("SUCCESS")} - ${bold("Bender")} approved!`))
        .catch(e => console.log(`${gray(time)}  ${red().bold("ERROR")} - ${e}`))
    }
  })
}