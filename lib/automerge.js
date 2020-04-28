module.exports = {

	context: {},

	run: async function(context) {

		this.context = context

		// Load config from .github/auto-merge.yml in the repository
    const config = await context.config('auto-merge.yml')

    this.pullRequest(context)
      .then(function(pullRequest) {
        return module.exports.checkBranch(pullRequest, config.branch)
      })
      .then(function(pullRequest) {
        return module.exports.checkLabel(pullRequest, config.requiredLabel, config.matchAllLabelRules)
      })
      .then(function(pullRequest) {
        return module.exports.checkAuthor(pullRequest, config.requiredAuthor, config.matchAllAuthorRules)
      })
      .then(function(pullRequest) { 
        module.exports.mergePullRequest(pullRequest, config.mergeMethod || 'squash')
      })
      .catch(function(e) {
        console.log(e)
        module.exports.context.log.error(e)
      })
	},

	pullRequest: async function(context) {
    const pr = context.payload.pull_request

    if (pr.state == 'open' && !pr.locked) return pr
    throw new Error("Pull Request #" + pr.number + " isn't opened or is locked")
  },

	checkBranch: async function (pr, required = "*") {
    required = required == "*" ? ".*" : required
    
    const response = pr.base.ref.match(required) != null
    this.statusCheck(pr, "check-branch: [" + required + "]", response)

    if(response) return pr
    throw new Error("Base branch isn't: " + required)
  },

  checkLabel: async function (pr, required = ["*"], matchAllLabelRules = false) {
    var result = []

    required = required.length < 1 ? ["*"] : required
    labels = (pr.labels || { name: "" }).map(label => label.name)

    result = required.map(function(regex) {
      return labels.filter(function(label) {
        if(label.match(regex == "*" ? ".*" : regex) == null) {
          return false
        }
        return true
      }).length > 0
    }) 

    const response = matchAllLabelRules ? !result.includes(false) : result.includes(true)
    this.statusCheck(pr, "check-label: [" + required.join(", ") + "]", response)

    if(response) return pr
    throw new Error("Missing " + required.join(", ") + " labels")
  },

  checkAuthor: async function(pr, required = ["*"], matchAllAuthorRules = false) {
    var result = []

    required = required.length < 1 ? ["*"] : required

    required.forEach(function(regex) {
      result.push(pr.user.login.match(regex == "*" ? ".*" : regex) != null)
    })

    const response = matchAllAuthorRules ? !result.includes(false) : result.includes(true)
    this.statusCheck(pr, "check-author: [" + required.join(", ") + "]", response)
    
    if(response) return pr
    throw new Error("Author doesn't match " + required.join(", "))
  },

  statusCheck: async function (pr, message, status) {

		const owner = pr.base.repo.owner.login
    const repo = pr.base.repo.name
    const sha = pr.head.sha

    const response = await this.context.github.checks.create({
      owner: owner, 
      repo: repo, 
      name: message, 
      head_sha: sha,
      status: "completed",
      conclusion: status ? "success" : "failure"
    })

    if(response.status > 200 && response.status < 300) {
      if(status) {
        this.context.log.info(message)
      } else {
        this.context.log.error(message)
      }
      return
    }
    throw "ERROOOW"
  },

  mergePullRequest: async function (pr, method) {
    const owner = pr.base.repo.owner.login
    const repo = pr.base.repo.name
    const sha = pr.head.sha
    const number = pr.number

    const response = await this.context.github.pulls.merge({
      owner: owner, 
      repo: repo, 
      pull_number: number,
      head_sha: sha,
      merge_method: method
    })

    if(response.data.merged) return true
    throw "ERROOOW"
  }
}