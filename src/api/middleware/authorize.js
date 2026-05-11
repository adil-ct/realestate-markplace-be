import axios from 'axios';
import mongoose from 'mongoose';
import config from '../config/config.js';
import logger from '../config/logger.js';
import messages from '../config/messages.js';
import { handleError } from '../helpers/requestHandler.js';
import { fetchUserFromPayment } from '../components/marketplace/service.js';
const { ObjectId } = mongoose.Types;

export const authorize = async (req, res, next) => {
  try {
    if (req.headers.mogulapikey) {
      if (req.headers.mogulapikey !== (await config.mogulApiKey)) {
        return handleError({
          res,
          statusCode: 401,
          err: messages.UNAUTHORIZED_TOKEN,
        });
      }
      const user = await fetchUserFromPayment(req.body.paymentId);
      if (!user) {
        return handleError({
          res,
          statusCode: 401,
          err: messages.UNAUTHORIZED_TOKEN,
        });
      }
      req.user = user;
      return next();
    } else {
      if (!req.headers.authorization) {
        return handleError({
          res,
          statusCode: 401,
          err: messages.TOKEN_NOT_PROVIDED,
        });
      }
      const result = await axios
        .get(`${await config.authBaseUrl}/verify`, {
          headers: {
            authorization: req.headers.authorization,
          },
        })
        .catch((error) => {
          logger.error(error);
          return { error: error };
        });
      if (result.error) {
        return handleError({
          res,
          statusCode: 401,
          err: result?.error ?? messages.UNAUTHORIZED_TOKEN,
        });
      }
      const user = result.data.data;
      if (user.userType === 'admin') {
      } else if (user.kycStatus === 'approved' && !user?.fireblocks?.vaultId) {
        return handleError({ res, err: messages.NO_WALLET, statusCode: 401 });
      }
      user._id = ObjectId(user._id);
      req.user = user;
      return next();
    }
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};
