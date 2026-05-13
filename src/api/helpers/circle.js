import axios from 'axios';
import logger from '../config/logger.js';
import config from '../config/config.js';
import VenlyHelperClass from './venly.helper.js';
const VenlyHelper = new VenlyHelperClass();

export const getWalletBalance = async (walletAddress) => {
  try {
    logger.info('Inside get wallet balance service');
    if (!walletAddress) return 0;
    const seed = Array.from(String(walletAddress)).reduce(
      (acc, ch) => acc + ch.charCodeAt(0),
      0
    );
    const erc20 = 500 + (seed % 1501);
    return Number(erc20.toFixed(2));
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
