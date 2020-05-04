exports.checkConfig = async (context) => {
  return context.config("auto-merge.yml").then(config => {
    if(config != null) {
      return config
    } else {
      throw new Error("Missing .github/auto-merge.yml config file")
    }
  })
}

exports.checkBranch = async (pullRequest, required = "*") => {
  required = required == "*" ? ".*" : "^" + required + "$"
  
  const response = pullRequest.base.ref.match(required) != null
  
  return response
}

exports.checkLabel = async (pullRequest, required = ["*"], matchAllLabelRules = false) => {
  const labels = (pullRequest.labels || { name: "" }).map(label => label.name)
  required = required.length < 1 ? ["*"] : required

  var result = required.map(regex => {
    return labels.filter(label => {
      if(label.match(regex == "*" ? ".*" : "^" + regex + "$") == null) {
        return false
      }
      return true
    }).length > 0
  })

  const response = matchAllLabelRules ? !result.includes(false) : result.includes(true)
  
  return response
}

exports.checkAuthor = async (pullRequest, required = ["*"], matchAllAuthorRules = false) => {
  var result = []

  required = required.length < 1 ? ["*"] : required

  required.forEach(regex => result.push(pullRequest.user.login.match(regex == "*" ? ".*" : regex) != null))

  const response = matchAllAuthorRules ? !result.includes(false) : result.includes(true)
  
  return response
}