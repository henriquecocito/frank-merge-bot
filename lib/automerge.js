'use strict';

const StatusCheck = require("./statusCheck.js")
const { checkConfig, checkBranch, checkLabel, checkAuthor } = require("./validations.js")

var api, status, log, config

class AutoMerge {
  
  isRunning = false

  constructor() {}

  static init (app, context) {
    return (async function () {
      let instance = new AutoMerge()
      await instance.build(app, context)
      return instance
    }())
  } 

  async build(app, context) {
    api    = await app.auth(context.payload.installation.id)
    config = await checkConfig(context)
    status = await StatusCheck.init(app, context, config.reportStatus)
    log    = app.log

    log.info(
      `\n-----> Triggered by "${context.name}.${context.payload.action}" event <-----\n
      Repository: ${context.payload.repository.owner.login}/${context.payload.repository.name}\n`)
  }
  
  async enqueue(pullRequests) {
    pullRequests.forEach(async pullRequest => {
      if(!this.isRunning) {
        this.run(pullRequest)
      }
    })
  }

  async run(pullRequest) {
    this.isRunning = true

    if(await !this.isMerged(pullRequest)) {
      const validateBranch = await checkBranch(pullRequest, config.branch)
        .then(response => { 
          status.send(pullRequest, "check-branch: [" + config.branch + "]", response) 
          return response
        })

      const validateAuthor = await checkAuthor(pullRequest, config.requiredAuthor, config.matchAllAuthorRules)
        .then(response => { 
          status.send(pullRequest, "check-author: [" + (config.requiredAuthor || ["*"]).join(", ") + "]", response) 
          return response
        })

      const validateLabel = await checkLabel(pullRequest, config.requiredLabel, config.matchAllLabelRules)
        .then(response => { 
          status.send(pullRequest, "check-label: [" + (config.requiredLabel || ["*"]).join(", ") + "]", response)
          return response
        })
        
      if(validateBranch && validateAuthor && validateLabel) {
        return this.mergePullRequest(pullRequest, config.mergeMethod)
      }
    }
  }

  async isMerged(pullRequest) {
    try {
      await api.pulls.checkIfMerged({
        owner: pullRequest.base.repo.owner.login, 
        repo: pullRequest.base.repo.name, 
        pull_number: pullRequest.number,
      })

      return true
    } catch (e) {
      return false
    }
  }

  async getApprovedReviews(pullRequest) {
    const response = await api.pulls.listReviews({
      owner: pullRequest.base.repo.owner.login, 
      repo: pullRequest.base.repo.name, 
      pull_number: pullRequest.number,
    })

    return response.data.filter(review => review.state == "APPROVED")
  }

  async callReviewersBots(reviewers, pullRequest) {
    return this.commentOnPullRequest(pullRequest, `${reviewers.join(", ")} check this out`)
  }

  async commentOnPullRequest(pullRequest, comment) {
    return api.pulls.createReview({
      owner: pullRequest.base.repo.owner.login, 
      repo: pullRequest.base.repo.name, 
      pull_number: pullRequest.number,
      body: comment,
      event: "COMMENT"
    })
  }

  async requestReview(pullRequest) {
    return api.pulls.createReviewRequest({
      owner: pullRequest.base.repo.owner.login, 
      repo: pullRequest.base.repo.name, 
      pull_number: pullRequest.number,
      reviewers: []
    })
  }

  async approvePullRequest(pullRequest) {
    return api.pulls.createReview({
      owner: pullRequest.base.repo.owner.login, 
      repo: pullRequest.base.repo.name, 
      pull_number: pullRequest.number,
      event: "APPROVE"
    })
  }

  async mergePullRequest (pullRequest, method = "squash") {
    return api.pulls.merge({
      owner: pullRequest.base.repo.owner.login, 
      repo: pullRequest.base.repo.name, 
      pull_number: pullRequest.number,
      sha: pullRequest.head.sha,
      merge_method: method
    })
  }
}

module.exports = AutoMerge