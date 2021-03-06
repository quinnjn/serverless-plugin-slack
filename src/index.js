const request = require('request');


class SlackServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    if (!this.serverless.service.custom.slack) { throw new Error('No Slack options set in config'); }

    if (!this.serverless.service.custom.slack.webhook_url) { throw new Error('No Slack webhook url set in config'); }

    this.hooks = {
      'after:deploy:function:deploy': this.afterDeployFunction.bind(this),
      'after:deploy:deploy': this.afterDeployService.bind(this),
    };
  }

  refreshVariables() {
    const reportable = this.serverless.service.custom.slack.reportable || {};
    this.reportableStages = reportable.stages;
    this.webhook_url = this.serverless.service.custom.slack.webhook_url;
    this.emoji = this.serverless.service.custom.slack.emoji;
    this.stage = this.options.stage || 'dev';
    this.user = this.serverless.service.custom.slack.user || process.env.DEPLOYER || process.env.USER;
    this.messageVariables = {
      ...process.env,
      user: this.user,
      name: this.options.f,
      service: this.serverless.service.service,
      stage: this.stage,
      region: this.serverless.service.provider.region,
    };
  }

  afterDeployFunction() {
    this.refreshVariables();

    if (this.reportableStages && !this.reportableStages.includes(this.stage)) {
      return
    }

    const message = this.serverless.service.custom.slack.function_deploy_message ||
      '`{{user}}` deployed function `{{name}}` to environment `{{stage}}` in service `{{service}}`';
    this.webhook_url = this.serverless.service.custom.slack.webhook_url;
    this.channel = this.serverless.service.custom.slack.channel;
    const parsedMessage = SlackServerlessPlugin.parseMessage(message, this.messageVariables);

    const body = {
      icon_emoji: this.emoji,
      channel: this.channel
    };
    const requestOptions = SlackServerlessPlugin
      .buildRequestOptions(this.webhook_url, parsedMessage, this.user, body);

    return SlackServerlessPlugin.sendWebhook(requestOptions);
  }

  afterDeployService() {
    this.refreshVariables();

    if (this.reportableStages && !this.reportableStages.includes(this.stage)) {
      return
    }

    const message = this.serverless.service.custom.slack.service_deploy_message ||
      '`{{user}}` deployed service `{{service}}` to environment `{{stage}}`';
    this.webhook_url = this.serverless.service.custom.slack.webhook_url;
    this.channel = this.serverless.service.custom.slack.channel;
    const parsedMessage = SlackServerlessPlugin.parseMessage(message, this.messageVariables);

    const body = {
      icon_emoji: this.emoji,
      channel: this.channel
    };
    const requestOptions = SlackServerlessPlugin
      .buildRequestOptions(this.webhook_url, parsedMessage, this.user, body);

    return SlackServerlessPlugin.sendWebhook(requestOptions);
  }

  static buildRequestOptions(url, message, user, bodyProperties) {
    let body = {
      text: message,
      username: user,
    }

    for (const [k, v] of Object.entries(bodyProperties || {})) {
      body[k] = v;
    }

    return {
      url,
      method: 'POST',
      headers: { 'Content-type': 'application/json' },
      body: JSON.stringify(body),
    };
  }
  static sendWebhook(options) {
    request(options, (error, response) => {
      if (!error && response.statusCode === 200) {
        console.log('Notified slack of deployment');
      } else {
        console.log(options);
        console.log('Something went wrong notifying slack');
      }
    });
  }

  static parseMessage(message, messageVariables) {
    return Object.entries(messageVariables).reduce((parsedMessage, [key, value]) => parsedMessage.replace(new RegExp(`{{${key}}}`, 'g'), value), message);
  }
}

module.exports = SlackServerlessPlugin;
