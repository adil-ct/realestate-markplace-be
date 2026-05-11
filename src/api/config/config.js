import dotenv from 'dotenv';
import AWS from '@aws-sdk/client-secrets-manager';
import moment from 'moment';
dotenv.config();
const region = process.env.AWS_REGION || 'us-west-1'
const SecretsManager = new AWS.SecretsManager({ region });


const config = {
  db: {
    str: 'DB_STRING',
  },
  httpRpcUrl: 'HTTP_RPC_URL',
  contracts: {
    Token: {
      address: 'TOKEN_CONTRACT_ADDRESS',
    },
    Marketplace: {
      address: 'MARKETPLACE_CONTRACT_ADDRESS',
    },
    Usdc: {
      address: 'USDC_CONTRACT_ADDRESS',
    },
  },
  chain: 'CHAIN',
  chainId: 'CHAIN_ID',
  metaTxService: {
    url: 'META_TX_URL',
    executeEndpoint: 'META_TX_EXECUTE_ENDPOINT',
    authToken: 'META_TX_AUTH_TOKEN',
  },
  userService: {
    url: 'USER_URL',
    getProofEndpoint: 'USER_GET_PROOF_ENDPOINT',
    authToken: 'USER_AUTH_TOKEN',
  },
  sqsQueueUrl: 'SQS_QUEUE_URL',
  authBaseUrl: 'AUTH_BASE_URL',
  baseUrl: 'BASE_URL',
  socketWebhook: {
    secret: 'SOCKET_WEBHOOK_SECRET',
    url: 'SOCKET_WEBHOOK_URL',
  },
  venly: {
    clientId: 'VENLY_CLIENT_ID',
    clientSecret: 'VENLY_CLIENT_SECRET',
    urls: {
      auth: {
        getAccessToken: 'VENLY_AUTH_GET_ACESS_TOKEN_URL',
      },
      wallet: {
        create: 'VENLY_WALLET_CREATE_URL',
      },
    },
  },
  referrals: {
    reward: 'REFERRALS_REWARD',
    investPeriod: 'REFERRALS_INVEST_PERIOD',
    adminThreshold: 'ADMIN_THRESHOLD_FOR_REFERRAL_REWARD',
    requiredInvestment: 'REFERRALS_REQUIRED_INVESTMENT',
    refereeReward: 'REFERRAL_REFEREE_REWARD',
  },
  affiliate: {
    percentage: 'AFFILIATE_PERCENTAGE',
  },
  sendEmailFrom: 'SEND_EMAIL_FROM',
  customerIO: {
    siteId: 'CUSTOMER_IO_SITE_ID',
    apiKey: 'CUSTOMER_IO_API_KEY',
    url: 'CUSTOMER_IO_URL',
    appApiKey: 'CUSTOMER_IO_APP_API_KEY',
  },
  mogulApiKey: 'MOGUL_API_KEY',
  crowdSale: {
    minInvestment: 'CROWDSALE_MINIMUM_INVESTMENT',
  },
  mercury: {
    url: 'MERCURY_BASE_URL',
  },
  crypto: {
    key: 'CRYPTO_KEY',
    encryptionIV: 'CRYPTO_ENCRYPTION_IV',
  },
  mogulFee: 'MOGUL_FEE',
  processingFee: 'PROCESSING_FEE',
  fireblocks: {
    apiKey: 'FIREBLOCKS_API_KEY',
    adminVaultAccountId: 'FIREBLOCKS_ADMIN_VAULT_ACCOUNT_ID',
    chainId: 'FIREBLOCKS_CHAIN_ID'
  },
};

let staleAfter = moment.utc();
const cachedConfig = {};
const updateObjProps = (obj, newObj, secretValues) => {
  for (const key in newObj) {
    if (newObj[key]?.constructor?.name === {}.constructor.name) {
      obj[key] = obj[key] ?? {};
      updateObjProps(obj[key], newObj[key], secretValues);
      continue;
    }
    obj[key] = secretValues[newObj[key]];
  }
};

const proxyConfig = new Proxy(config, {
  async get(target, prop, _originalObj) {
    try {
      if (staleAfter.unix() > moment.utc().unix()) return cachedConfig[prop];
      let values = {};
      if (process.env.AWS_SECRETS_MANAGER_ID) {
        console.log(process.env.AWS_SECRETS_MANAGER_ID)
        const result = await SecretsManager.getSecretValue({
          SecretId: process.env.AWS_SECRETS_MANAGER_ID,
        });
        values = JSON.parse(result.SecretString);
      } else {
        values = {
          DB_STRING: process.env.DB_STRING,
          HTTP_RPC_URL: process.env.HTTP_RPC_URL,
          TOKEN_CONTRACT_ADDRESS: process.env.TOKEN_CONTRACT_ADDRESS,
          MARKETPLACE_CONTRACT_ADDRESS:
            process.env.MARKETPLACE_CONTRACT_ADDRESS,
          USDC_CONTRACT_ADDRESS: process.env.USDC_CONTRACT_ADDRESS,
          CHAIN: process.env.CHAIN,
          CHAIN_ID: process.env.CHAIN_ID,
          META_TX_URL: process.env.META_TX_URL,
          META_TX_EXECUTE_ENDPOINT: process.env.META_TX_EXECUTE_ENDPOINT,
          META_TX_AUTH_TOKEN: process.env.META_TX_AUTH_TOKEN,
          USER_URL: process.env.USER_URL,
          USER_GET_PROOF_ENDPOINT: process.env.USER_GET_PROOF_ENDPOINT,
          USER_AUTH_TOKEN: process.env.USER_AUTH_TOKEN,
          CIRCLE_API_KEY: process.env.CIRCLE_API_KEY,
          CIRCLE_BASE_URL: process.env.CIRCLE_BASE_URL,
          SQS_QUEUE_URL: process.env.SQS_QUEUE_URL,
          AUTH_BASE_URL: process.env.AUTH_BASE_URL,
          BASE_URL: process.env.BASE_URL,
          SOCKET_WEBHOOK_SECRET: process.env.SOCKET_WEBHOOK_SECRET,
          SOCKET_WEBHOOK_URL: process.env.SOCKET_WEBHOOK_URL,
          VENLY_CLIENT_ID: process.env.VENLY_CLIENT_ID,
          VENLY_CLIENT_SECRET: process.env.VENLY_CLIENT_SECRET,
          VENLY_AUTH_GET_ACESS_TOKEN_URL:
            process.env.VENLY_AUTH_GET_ACESS_TOKEN_URL,
          VENLY_WALLET_CREATE_URL: process.env.VENLY_WALLET_CREATE_URL,
          REFERRALS_REWARD: process.env.REFERRALS_REWARD,
          REFERRALS_INVEST_PERIOD: process.env.REFERRALS_INVEST_PERIOD,
          ADMIN_THRESHOLD_FOR_REFERRAL_REWARD:
            process.env.ADMIN_THRESHOLD_FOR_REFERRAL_REWARD,
          REFERRALS_REQUIRED_INVESTMENT:
            process.env.REFERRALS_REQUIRED_INVESTMENT,
          REFERRAL_REFEREE_REWARD: process.env.REFERRAL_REFEREE_REWARD,
          AFFILIATE_PERCENTAGE: process.env.AFFILIATE_PERCENTAGE,
          SEND_EMAIL_FROM: process.env.SEND_EMAIL_FROM,
          CUSTOMER_IO_SITE_ID: process.env.CUSTOMER_IO_SITE_ID,
          CUSTOMER_IO_API_KEY: process.env.CUSTOMER_IO_API_KEY,
          CUSTOMER_IO_URL: process.env.CUSTOMER_IO_URL,
          CUSTOMER_IO_APP_API_KEY: process.env.CUSTOMER_IO_APP_API_KEY,
          MOGUL_API_KEY: process.env.MOGUL_API_KEY,
          CROWDSALE_MINIMUM_INVESTMENT:
            process.env.CROWDSALE_MINIMUM_INVESTMENT,
          MERCURY_BASE_URL: process.env.MERCURY_BASE_URL,
          CRYPTO_KEY: process.env.CRYPTO_KEY,
          CRYPTO_ENCRYPTION_IV: process.env.CRYPTO_ENCRYPTION_IV,
          MOGUL_FEE: process.env.MOGUL_FEE,
          PROCESSING_FEE: process.env.PROCESSING_FEE,
          FIREBLOCKS_API_KEY: process.env.FIREBLOCKS_API_KEY,
          FIREBLOCKS_ADMIN_VAULT_ACCOUNT_ID:
            process.env.FIREBLOCKS_ADMIN_VAULT_ACCOUNT_ID,
          FIREBLOCKS_CHAIN_ID: process.env.FIREBLOCKS_CHAIN_ID
        };
      }
      updateObjProps(cachedConfig, target, values);
      staleAfter = moment.utc().add(60, 'seconds');

      return cachedConfig[prop];
    } catch (err) {
      throw err;
    }
  },
});

export default proxyConfig;
