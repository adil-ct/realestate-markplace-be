import config from '../config/config.js';
import axios from 'axios';
import logger from '../config/logger.js';

export const getUserWhitelistedProof = async (blockchainAddress) => {
  try {
    const { url, getProofEndpoint, authToken } = await config.userService;
    const {
      data: { data: proof },
    } = await axios.get(`${url}${getProofEndpoint}/${blockchainAddress}`, { headers: { 'x-auth-token': authToken } });
    return { hasError: false, value: proof };
  } catch (err) {
    logger.error(err?.response?.data?.msg ?? err);
    return { hasError: true, error: err?.response?.data?.msg ?? err.message };
  }
};
