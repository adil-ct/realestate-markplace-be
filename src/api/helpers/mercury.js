import axios from 'axios';
import crypto from 'crypto';
import logger from '../config/logger.js';
import config from '../config/config.js';

export const mercuryGetRequest = async (path, token) => {
  try {
    const buff = Buffer.from(token, 'base64');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      (await config.crypto).key,
      (await config.crypto).encryptionIV
    );
    token =
      decipher.update(buff.toString('utf8'), 'hex', 'utf8') +
      decipher.final('utf8');
    const url = (await config.mercury).url + path;
    logger.info('Fetching from API ' + url);
    const options = {
      method: 'GET',
      url,
      headers: { accept: 'application/json', Authorization: `Bearer ${token}` },
    };
    const response = await axios.request(options);
    return response.data;
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};
