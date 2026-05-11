import axios from 'axios';
import logger from '../config/logger.js';
import config from '../config/config.js';
import VenlyHelperClass from './venly.helper.js';
const VenlyHelper = new VenlyHelperClass();

export const getWalletBalance = async (walletAddress) => {
  try {
    logger.info('Inside get wallet balance service');
    let erc20 = 0;
    let balance = await VenlyHelper.getWalletBalance(walletAddress);
    if (balance?.value.length === 0) erc20 = 0;
    balance.value.forEach((el) => {
      if (el.symbol === 'USDC') {
        erc20 += el.balance;
      }
    });
    return erc20;
  } catch (err) {
    logger.error(err.message);
    return { error: err?.message };
  }
};

export const createTransfer = async (data) => {
  try {
    logger.info('Inside create transfer circle API request');
    const response = await axios.post(
      `${(await config.circle).baseUrl}/transfers`,
      data,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: 'Bearer' + (await config.circle).apiKey,
        },
      }
    );
    response.data.status = response.status;
    return response.data;
  } catch (err) {
    logger.error(err.message);
    return { error: err?.response?.data?.message ?? err?.message };
  }
};
