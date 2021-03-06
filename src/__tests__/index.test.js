/* eslint-disable no-undef */
const SlackServerlessPlugin = require('../index');

describe('serverless plugin slack', () => {
  const defaultProvider = {
    name: 'aws',
    region: 'us-east-2',
    env: 'dev',
    runtime: 'nodejs10.x',
  };

  test('it fails on absent config ', () => {
    const config = { service: { custom: {}, provider: defaultProvider } };

    expect(() => { new SlackServerlessPlugin(config); }).toThrow('No Slack options set in config');
  });

  test('it fails on absent webhook url ', () => {
    const config = { service: { custom: { slack: {} } } };

    expect(() => { new SlackServerlessPlugin(config); }).toThrow('No Slack webhook url set in config');
  });

  test('sends an emoji when defined', () => {
    const config = { service: { service: 'foobar', custom: { slack: { emoji: ':cloud:', user: 'jd', webhook_url: 'https://example.com' } }, provider: defaultProvider } };
    const options = { f: 'bar', stage: 'staging' };

    const plugin = new SlackServerlessPlugin(config, options);

    SlackServerlessPlugin.sendWebhook = jest.fn();

    plugin.afterDeployService();

    expect(SlackServerlessPlugin.sendWebhook).toHaveBeenCalledWith({
      body: '{\"text\":\"`jd` deployed service `foobar` to environment `staging`\",\"username\":\"jd\",\"icon_emoji\":\":cloud:\"}',
      headers: { 'Content-type': 'application/json' },
      method: 'POST',
      url: 'https://example.com',
    });
  });

  it(`allows channel overwrite`, () => {
    const config = {
      service: {
        service: 'foobar',
        custom: {
          slack: {
            webhook_url: 'https://example.com',
            channel: `@user`
          }
        },
        provider: defaultProvider
      }
    };
    const options = {};

    const plugin = new SlackServerlessPlugin(config, options);

    SlackServerlessPlugin.sendWebhook = jest.fn();

    plugin.afterDeployService();

    expect(SlackServerlessPlugin.sendWebhook).toHaveBeenCalledWith({
      body: JSON.stringify({
        text: '`admin` deployed service `foobar` to environment `dev`',
        username: 'admin',
        channel: '@user',
      }),
      headers: { 'Content-type': 'application/json' },
      method: 'POST',
      url: 'https://example.com',
    });
  });

  describe("reportable", () => {
    test("does not report to non-reportable environments", () => {
      const slack = {
        user: 'jd',
        webhook_url: 'some-uri',
        reportable: {
          stages: ['dev']
        }
      };
      const config = { service: { service: 'foobar', custom: { slack }, provider: defaultProvider } };
      const options = { f: 'bar', stage: 'ci' };

      const plugin = new SlackServerlessPlugin(config, options);

      SlackServerlessPlugin.sendWebhook = jest.fn();

      plugin.afterDeployFunction();

      expect(SlackServerlessPlugin.sendWebhook).not.toHaveBeenCalledWith();
    });
  });

  describe('single function deployment', () => {
    test('it sends message', () => {
      const config = { service: { service: 'foobar', custom: { slack: { user: 'jd', webhook_url: 'https://example.com' } }, provider: defaultProvider } };
      const options = { f: 'bar', stage: 'staging' };

      const plugin = new SlackServerlessPlugin(config, options);

      SlackServerlessPlugin.sendWebhook = jest.fn();

      plugin.afterDeployFunction();

      expect(SlackServerlessPlugin.sendWebhook).toHaveBeenCalledWith({
        body: '{\"text\":\"`jd` deployed function `bar` to environment `staging` in service `foobar`\",\"username\":\"jd\"}',
        headers: { 'Content-type': 'application/json' },
        method: 'POST',
        url: 'https://example.com',
      });
    });
  });

  describe('service deployment', () => {
    test('it sends message', () => {
      const config = { service: { service: 'foobar', custom: { slack: { user: 'jd', webhook_url: 'https://example.com' } }, provider: defaultProvider } };
      const options = { f: 'bar', stage: 'staging' };

      const plugin = new SlackServerlessPlugin(config, options);

      SlackServerlessPlugin.sendWebhook = jest.fn();

      plugin.afterDeployService();

      expect(SlackServerlessPlugin.sendWebhook).toHaveBeenCalledWith({
        body: '{\"text\":\"`jd` deployed service `foobar` to environment `staging`\",\"username\":\"jd\"}',
        headers: { 'Content-type': 'application/json' },
        method: 'POST',
        url: 'https://example.com',
      });
    });

    test('it sends message with region', () => {
      const config = {
        service: {
          service: 'foobar',
          custom: {
            slack: {
              user: 'jd',
              webhook_url: 'https://example.com',
              service_deploy_message: 'in {{region}}'
            }
          },
          provider: defaultProvider,
        },
      };
      const options = { f: 'bar', stage: 'staging' };

      const plugin = new SlackServerlessPlugin(config, options);

      SlackServerlessPlugin.sendWebhook = jest.fn();

      plugin.afterDeployService();

      expect(SlackServerlessPlugin.sendWebhook).toHaveBeenCalledWith({
        body: '{\"text\":\"in us-east-2\",\"username\":\"jd\"}',
        headers: { 'Content-type': 'application/json' },
        method: 'POST',
        url: 'https://example.com',
      });
    });
  });

  describe('default parameters properly', () => {
    test('it sends message', () => {
      const config = { service: { service: 'foobar', custom: { slack: { user: 'jd', webhook_url: 'https://example.com' } }, provider: defaultProvider } };
      const options = { f: 'bar' };

      const plugin = new SlackServerlessPlugin(config, options);

      SlackServerlessPlugin.sendWebhook = jest.fn();

      plugin.afterDeployService();

      expect(SlackServerlessPlugin.sendWebhook).toHaveBeenCalledWith({
        body: '{\"text\":\"`jd` deployed service `foobar` to environment `dev`\",\"username\":\"jd\"}',
        headers: { 'Content-type': 'application/json' },
        method: 'POST',
        url: 'https://example.com',
      });
    });
  });

  describe('environment variables', () => {
    test('Uses process.env.GIT_SHA in the message', () => {
      process.env.GIT_SHA = 'deadbeef';
      process.env.USER = 'admin';
      process.env.DEPLOYER = 'admin';

      const config = {
        service: {
          service: 'foobar',
          custom: {
            slack: {
              service_deploy_message: 'git sha: {{GIT_SHA}}',
              webhook_url: 'https://example.com',
            },
          },
          provider: defaultProvider,
        },
      };
      const options = { f: 'bar' };

      const plugin = new SlackServerlessPlugin(config, options);

      SlackServerlessPlugin.sendWebhook = jest.fn();

      plugin.afterDeployService();

      expect(SlackServerlessPlugin.sendWebhook).toHaveBeenCalledWith({
        body: JSON.stringify({
          text: 'git sha: deadbeef',
          username: 'admin',
        }),
        headers: { 'Content-type': 'application/json' },
        method: 'POST',
        url: 'https://example.com',
      });
    });

    test("Can set the user from process.env.DEPLOYER", () => {
      process.env.DEPLOYER = "imadeployer";
      const config = { service: { service: 'foobar', custom: { slack: { webhook_url: 'https://example.com' } }, provider: defaultProvider } };
      const options = { f: 'bar' };

      const plugin = new SlackServerlessPlugin(config, options);

      SlackServerlessPlugin.sendWebhook = jest.fn();

      plugin.afterDeployService();

      expect(SlackServerlessPlugin.sendWebhook).toHaveBeenCalledWith({
        body: '{\"text\":\"`imadeployer` deployed service `foobar` to environment `dev`\",\"username\":\"imadeployer\"}',
        headers: { 'Content-type': 'application/json' },
        method: 'POST',
        url: 'https://example.com',
      });
    });
  });
});
