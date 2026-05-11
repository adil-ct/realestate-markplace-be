import {
  TrackClient,
  RegionUS,
  APIClient,
  SendEmailRequest,
} from 'customerio-node';
import logger from '../../config/logger.js';
import messages from '../../config/messages.js';
import { generateuuid } from '../../helpers/helpers.js';
import moment from 'moment';
import { handleError, handleResponse } from '../../helpers/requestHandler.js';
import {
  getPropertyList,
  getPropertyDetails,
  buyProperty,
  getOrders,
  tokensAtSold,
  getMarketList,
  createMarketInDb,
  editMarket,
  getMarketDetails,
  getMarketByField,
  investorPortfolioSummary,
  managerPortfolioSummary,
  propertyHoldings,
  getPropertyTransactionsService,
  assetSummary,
  listAssetsService,
  propertyManagerAssetSummary,
  propertyTransactionsForPM,
  getReservesTransaction,
  getCoowners,
  checkForMarketAssigned,
  deleteMarketDoc,
  transferOwnership,
  fetchCheckoutPayment,
  checkoutPaymentFailed,
  unholdTokensAndCredits,
  getFullPropertyDetails,
  getUserProperties,
  getPropertyInvestors,
  getAllComparableProperties,
  createComparablePropertyInDB,
  updateComparablePropertyInDB,
  deleteComparablePropertyInDB,
  getComparablePropertyinDB,
  getAllComparablePropertiesByPropertyId,
} from './service.js';
import { createTransfer, getWalletBalance } from '../../helpers/circle.js';
import {
  comparablePropertyValidator,
  marketCreateRequest,
  propertyListValidator,
} from './validator.js';
import web3Helper from '../../helpers/web3.fireblocks.js';
import orderModel from './orderModel.js';
import db from '../../connections/dbMaster.js';
const propertyModel = db.collection('property');
const userModel = db.collection('user');
const referralModel = db.collection('referral');
const adminModel = db.collection('admin');
const transfersModel = db.collection('transfers');
import PropertyBalance from '../marketplace/propertyBalance.model.js';
import { Types } from 'mongoose';
import { getUserWhitelistedProof } from '../../helpers/whitelist-proof.js';
import { auth_sendEmail } from '../../helpers/auth.js';
import config from '../../config/config.js';
import propertyBalanceModel from './propertyBalance.model.js';
import { bridgeMintNewTokens } from '../migration-scripts.js/token.js';
const ObjectId = Types.ObjectId;
let cio = new TrackClient(
  (await config.customerIO).siteId,
  (await config.customerIO).apiKey,
  {
    region: RegionUS,
  }
);
const cioTransactionalClient = new APIClient(
  (await config.customerIO).appApiKey,
  { region: RegionUS }
);

export const propertyList = async (req, res) => {
  try {
    logger.info('Inside property List API controller');
    const validation = propertyListValidator(req.query);
    if (validation.hasError) {
      return handleError({
        err: validation.error,
        res,
        statusCode: 422,
      });
    }
    const { sanitizedData } = validation;
    const list = await getPropertyList(sanitizedData);
    if (list?.error) {
      return handleError({ res, err: list.error });
    }
    return handleResponse({ res, msg: messages.PROPERTY_LIST, data: list });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const getMarket = async (req, res) => {
  try {
    logger.info('Inside get Market API controller');
    const list = await getMarketList();
    if (list?.error) {
      return handleError({
        res,
        err: list.error || messages.SOMETHING_WENT_WRONG,
      });
    }
    if (list) {
      return handleResponse({
        res,
        data: list,
      });
    }
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const fullPropertyDetails = async (req, res) => {
  try {
    logger.info('Inside full property details API controller');
    const propertyId = req.params.id;
    const details = await getFullPropertyDetails(propertyId);
    if (details?.error) {
      return handleError({ res, err: details.error });
    }
    return handleResponse({
      res,
      msg: messages.PROPERTY_DETAILS,
      data: details,
    });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const propertyDetails = async (req, res) => {
  try {
    logger.info('Inside property details API controller');
    const propertyId = req.params.id;
    const { request } = req.query;
    const details = await getPropertyDetails(propertyId, request);
    if (details?.error) {
      return handleError({ res, err: details.error });
    }
    return handleResponse({
      res,
      msg: messages.PROPERTY_DETAILS,
      data: details,
    });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const getPropertyTransactions = async (req, res) => {
  try {
    logger.info('Inside get property transactions API controller');
    const user = req.user;
    const propertyId = req.params.id;
    const qString = {
      _property: new ObjectId(propertyId),
      $or: [{ buyerId: user._id }, { sellerId: user._id }],
    };
    const data = {
      ...req.query,
      userId: user._id,
      query: qString,
    };
    let transactions;
    if (user.userType === 'property_manager') {
      transactions = await propertyTransactionsForPM(
        propertyId,
        req.query,
        user._id
      );
    } else {
      transactions = await getPropertyTransactionsService(data);
    }
    if (transactions?.error) {
      return handleError({ res, err: transactions.error });
    }
    return handleResponse({
      res,
      msg: messages.PROPERTY_TRANSACTIONS,
      data: transactions,
      result: transactions.length,
    });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const createMarket = async (req, res) => {
  try {
    logger.info('Inside create market API controller');
    const validation = await marketCreateRequest(req.body);
    if (validation.error) {
      return handleError({ res, err: validation.message });
    }
    const { marketName } = req.body;
    const marketExist = await getMarketByField(marketName, 'marketName');

    if (marketExist?.error) {
      return handleError({ res, err: marketExist.error });
    }
    if (marketExist) {
      return handleError({
        res,
        err: messages.MARKET_NAME_IS_REGISTERED,
        statusCode: 400,
      });
    }
    const market = await createMarketInDb(req.body);
    if (market?.error || !market) {
      return handleError({
        res,
        err: market.error || messages.SOMETHING_WENT_WRONG,
      });
    }
    return handleResponse({
      res,
      msg: messages.SUCCESS,
      data: market,
    });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const invest = async (req, res) => {
  try {
    logger.info('Inside invest API controller');
    const { propertyId, paymentId } = req.body;
    let tokens = 0;
    const user = req.user;

    /* Check for Super Admin */
    if (user.userType === 'admin' && user.isSuperAdmin === false) {
      return handleError({ res, err: messages.FORBIDDEN, statusCode: 403 });
    }

    /* Fetch Property Details */
    const property = await getPropertyDetails(propertyId);
    if (property?.error) {
      return handleError({ res, err: property.error });
    }
    if (!property)
      return handleError({ res, err: messages.PROPERTY_NOT_FOUND });

    /* If Mogul Equity is already bought */
    if (user.userType === 'admin' && property.crowdSale?.isMogulEquityBought) {
      return handleError({
        res,
        err: messages.MOGUL_EQUITY_ALREADY_BOUGHT,
        statusCode: 400,
      });
    }
    // if (user.userType !== 'admin' && !property.crowdSale?.isMogulEquityBought) {
    //   return handleError({ res, err: messages.FORBIDDEN, statusCode: 403 });
    // }

    /* Price per token caluclation */
    const pricePerToken =
      (property.financials.propertyValues[
        property.financials.propertyValues.length - 1
      ].value -
        property.financials.currentDebt) /
      property.crowdSale.numberOfTokens;
    if (user.userType === 'admin') {
      tokens = property.financials.mogulEquityToBuy / pricePerToken;
    }

    /* If mogulEquityToBuy is 0 */
    if (user.userType === 'admin' && tokens === 0) {
      await propertyModel.updateOne(
        { _id: property._id },
        { $set: { 'crowdSale.isMogulEquityBought': true } }
      );
      return handleResponse({ res, msg: messages.INVESTMENT_SUCCESSFULL });
    }

    const admin = user.userType === 'admin' ? true : false;

    let onlyCredits = false;
    /* Verify checkout payment with amount equivalent to required balance */
    const checkoutPayment = await fetchCheckoutPayment(paymentId, admin);
    if (!checkoutPayment || checkoutPayment?.error) {
      return handleError({
        res,
        err: checkoutPayment?.error ?? 'No checkout payment found',
      });
    }

    if (checkoutPayment.investmentStatus === 'completed') {
      return handleError({
        res,
        err: 'Investment already performed for this checkout',
        statusCode: 400,
      });
    }

    if (checkoutPayment.status !== 'succeeded') {
      await checkoutPaymentFailed(
        checkoutPayment._id,
        'Investment failed due to invalid Payment checkout'
      );
      return handleError({
        res,
        err: 'Investment failed due to invalid Payment checkout',
        statusCode: 400,
      });
    }

    if (parseFloat(checkoutPayment.amount.amount) <= 0) onlyCredits = true;
    tokens = checkoutPayment.holdTokens;

    /* Check for minimum investment */
    /* if (user.userType !== 'admin') {
      const minInvest =
        property.crowdSale.minInvestment ??
        (await config.crowdSale).minInvestment;

      if (parseFloat(checkoutPayment.amount.amount) < parseFloat(minInvest)) {
        if (onlyCredits) {
          await unholdTokensAndCredits(checkoutPayment._id);
        }
        return handleError({
          res,
          err: `Minimum investment required is $${minInvest}`,
          statusCode: 400,
        });
      }
    } */

    const creditsOnHold =
      checkoutPayment.holdCredits.credits +
      checkoutPayment.holdCredits.rentCredits +
      checkoutPayment.holdCredits.giftCredits;
    const creditsUsed = creditsOnHold;
    const orderIds = checkoutPayment.holdOrders;

    const { result, updatedNew } = await getOrders(
      tokens,
      propertyId,
      orderIds
    );
    if (result.length === 0 && updatedNew.length === 0) {
      if (onlyCredits) {
        await unholdTokensAndCredits(checkoutPayment._id);
      }
      return handleError({ res, err: 'Orders Failed to Be Exectued' });
    }

    let crowdsale = true;
    if (
      moment.utc(property.crowdSale.startDate).unix() > moment.utc().unix() ||
      moment.utc(property.crowdSale.stopDate).unix < moment.utc().unix()
    ) {
      crowdsale = false;
    }
    if (
      (!property.crowdSale?.status ||
        property.crowdSale?.status !== 'completed') &&
      admin
    ) {
      crowdsale = true;
    }
    if (!crowdsale && !admin) {
      if (onlyCredits) {
        await unholdTokensAndCredits(checkoutPayment._id);
      }
      return handleError({ res, err: messages.FORBIDDEN, statusCode: 403 });
    }
    const buy = await buyProperty(
      result,
      updatedNew,
      { buyerId: user._id, buyerAddress: user.blockchainAddress, admin },
      { pricePerToken, crowdsale, _property: property._id },
      user,
      property,
      creditsUsed,
      paymentId,
      checkoutPayment
    );
    if (buy?.error) {
      await checkoutPaymentFailed(checkoutPayment._id, buy.error);
      if (onlyCredits) {
        await unholdTokensAndCredits(checkoutPayment._id);
      }
      return handleError({ res, err: buy.error });
    }

    const tokenTxnId = buy?.length > 0 ? buy[0]?.value?.insertedId : '';

    if (!user?.firstInvestment) {
      const fetchInvestment = await transfersModel.findOne({
        userId: user._id,
        transactionType: 'marketplace',
      });
      await userModel.updateOne(
        { _id: user._id },
        { $set: { firstInvestment: fetchInvestment.amount.amount } }
      );
    }

    /* Referral and affiliate */
    /* START
    const referralObj = await referralModel.findOne({
      'referee.refereeId': ObjectId(user._id),
    });
    if (referralObj) {
      let refereeObj = referralObj.referee.filter(
        (arr) => arr.refereeId.toString() === user._id.toString()
      );
      refereeObj = refereeObj.length > 0 ? refereeObj[0] : {};

      let refUser = await userModel.findOne({
        _id: referralObj.referralId,
      });
      let refereeUser = await userModel.findOne({
        _id: refereeObj.refereeId,
      });

      if (!refereeObj.isAvailed) {
        let rewards = 0;
        if (referralObj?.affiliate) {
          const affiliatePercentage = parseFloat(
            (await config.affiliate).percentage
          );
          rewards = (
            (parseFloat(checkoutPayment.amount.amount) -
              parseFloat(checkoutPayment.fees.amount)) *
            (affiliatePercentage / 100)
          ).toFixed(2);
          rewards = parseFloat(rewards);
        } else {
          const referralRewardAmt = parseFloat((await config.referrals).reward);
          rewards = referralRewardAmt;
        }

        const updatedReferralEarnings = referralObj.referralEarnings + rewards;
        const refereeEarning = rewards;

        await userModel.updateOne(
          { _id: refUser._id },
          { $inc: { credits: rewards } }
        );

        await userModel.updateOne(
          { _id: refereeUser._id },
          { $inc: { credits: rewards } }
        );

        await referralModel.updateOne(
          {
            _id: referralObj._id,
            'referee.refereeId': ObjectId(user._id),
          },
          {
            $set: {
              'referee.$.reward': rewards,
              'referee.$.refereeReward': refereeEarning,
              'referee.$.isAvailed': true,
              referralEarnings: updatedReferralEarnings,
            },
          }
        );

        let uuid = await generateuuid();
        await transfersModel.insertOne({
          id: uuid,
          amount: {
            amount: rewards,
            asset: 'USD',
          },
          quoteCurrencyAmount: rewards,
          transactionType: 'rewards',
          rewardType: referralObj.affiliate ? 'Affiliate' : 'Referral',
          transferType: 'received',
          status: 'completed',
          admin: true,
          userId: refUser._id,
          referral: true,
          refereeId: refereeUser._id,
          investmentId: checkoutPayment._id,
          tokenTxnId: tokenTxnId,
          amountToRewarded: checkoutPayment.amount.amount,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        uuid = await generateuuid();
        await transfersModel.insertOne({
          id: uuid,
          amount: {
            amount: rewards,
            asset: 'USD',
          },
          quoteCurrencyAmount: rewards,
          transactionType: 'rewards',
          rewardType: referralObj.affiliate ? 'Affiliate' : 'Referral',
          transferType: 'received',
          status: 'completed',
          admin: true,
          userId: refereeUser._id,
          referee: true,
          referralId: refUser._id,
          investmentId: checkoutPayment._id,
          tokenTxnId: tokenTxnId,
          amountToRewarded: checkoutPayment.amount.amount,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await auth_sendEmail({
          email: [refUser.email, refereeUser.email],
          type: 'REWARDS',
          request: {
            referral: referralObj.affiliate ? false : true,
            amount_received: rewards,
          },
        });
      }
    }
    END */

    /* Customer IO */
    if (process.env.NODE_ENV === 'production') {
      cio.identify(user.email, {
        property_id_invested: property._id,
      });
    }
    if (checkoutPayment.transactionType === 'Promotion') {
      // Note: this is a 1-time test using cio for transactional email.
      // If/when we switch from SendGrid to Customer.io we'll need to update
      // everything else which sends a template name to /auth/email
      const emailTemplateID = 3;
      const emailRequest = new SendEmailRequest({
        to: user.email,
        from: await config.sendEmailFrom,
        transactional_message_id: emailTemplateID,
        identifiers: {
          email: user.email,
        },
        message_data: {
          first_name: user.firstName,
        },
      });

      cioTransactionalClient.sendEmail(emailRequest);
    }

    return handleResponse({ res, msg: messages.INVESTMENT_SUCCESSFULL });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const listAssets = async (req, res) => {
  try {
    logger.info('Inside List Assets API controller');
    const user = req.user;
    const listRes = await listAssetsService(user, req.query);
    if (listRes.hasError) {
      return handleError({ res, err: listRes.error });
    }
    return handleResponse({
      res,
      msg: messages.ASSETS_LIST,
      data: listRes,
    });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const userProperties = async (req, res) => {
  try {
    logger.info('Inside User Properties API controller');
    const user = req.user;
    const listRes = await getUserProperties(user);
    if (listRes.hasError) {
      return handleError({ res, err: listRes.error });
    }
    return handleResponse({
      res,
      msg: messages.ASSETS_LIST,
      data: listRes,
    });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const propertyInvestors = async (req, res) => {
  try {
    logger.info('Inside User Properties API controller');
    const propertyId = req.params.id;
    const investorsRes = await getPropertyInvestors(propertyId);
    if (investorsRes.hasError) {
      return handleError({ res, err: listRes.error });
    }
    return handleResponse({
      res,
      msg: messages.PROPERTY_INVESTORS,
      data: investorsRes,
    });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const getPortfolioSummary = async (req, res) => {
  try {
    logger.info('Inside Get Portfolio Summary API controller');
    const user = req.user;
    const { page, limit, search } = req.query;
    let summary;
    if (user.userType === 'investor') {
      summary = await investorPortfolioSummary(user);
    } else {
      summary = await managerPortfolioSummary(user, page, limit, search);
    }
    if (summary.hasError) {
      return handleError({ res, err: summary.error });
    }
    return handleResponse({
      res,
      msg: messages.PORTFOLIO_SUMMARY,
      data: summary.value,
    });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const getAssetSummary = async (req, res) => {
  try {
    logger.info('Inside Get Asset Summary API controller');
    const user = req.user;
    const { propertyId: _property } = req.params;
    const summary = await assetSummary(user, _property);
    if (summary.hasError) {
      return handleError({ res, err: summary.error });
    }
    return handleResponse({
      res,
      msg: messages.ASSET_SUMMARY,
      data: summary.value,
    });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const viewMarket = async (req, res) => {
  try {
    logger.info('Inside view Market API controller');
    const { id } = req.params;
    const marketDetails = await getMarketDetails(id);
    if (marketDetails) {
      return handleResponse({
        res,
        data: marketDetails,
        msg: messages.SUCCESS,
      });
    }
    if (marketDetails?.error) {
      return handleError({
        res,
        err: marketDetails.error || messages.SOMETHING_WENT_WRONG,
      });
    }
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const propertyHolding = async (req, res) => {
  try {
    logger.info('Inside property holding API controller');
    const user = req.user;
    const propertyId = req.params.id;
    const holding = await propertyHoldings(user._id, propertyId);
    if (holding?.error) {
      return handleError({ res, err: holding.error });
    }
    return handleResponse({
      res,
      msg: messages.PROPERTY_HOLDING,
      data: holding,
    });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const updateMarket = async (req, res) => {
  try {
    logger.info('Inside update Market API controller');
    const validation = await marketCreateRequest(req.body);
    if (validation.error) {
      return handleError({ res, err: validation.message });
    }
    const id = req.params.id;
    const marketExist = await getMarketByField(id, '_id');
    if (!marketExist) {
      return handleError({
        res,
        err: messages.MARKET_NOT_EXIST,
      });
    }
    const market = await editMarket(id, req.body);
    return handleResponse({ res, msg: messages.SUCCESS, data: market });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const putOnSale = async (req, res) => {
  try {
    logger.info('Inside Put on Sale API controller');
    const { propertyId: _property } = req.params;
    const { user: __user } = req;
    const property = await propertyModel.findOne({
      _id: new ObjectId(_property),
    });
    if (!property) {
      return handleError({
        res,
        err: messages.PROPERTY_NOT_FOUND,
        statusCode: 400,
      });
    }
    const user = await userModel.findOne({
      _id: ObjectId(property.otherInfo._owner),
    });
    const approval = await web3Helper.ExecuteMethod(
      'SEND',
      web3Helper.contracts.Token,
      'customSetApprovalForAll',
      [user.blockchainAddress, web3Helper.Marketplace.options.address, true]
    );
    if (approval.error) {
      return handleError({
        res,
        err: approval.message,
        statusCode: 500,
      });
    }
    const pricePerToken =
      (property.financials.propertyValues[
        property.financials.propertyValues.length - 1
      ].value -
        property.financials.currentDebt) /
      property.crowdSale.numberOfTokens;
    const tokens =
      (property.financials.mogulEquityToBuy +
        property.financials.mogulEquityToSell) /
      pricePerToken;

    const priceInWei = web3Helper.strToUSDCConvert(pricePerToken);
    console.log({
      estateId: property.otherInfo.estateId,
      tokens: tokens.toString(),
      price: priceInWei.toString(),
      0: 0,
      userAddress: user.blockchainAddress,
      propAddress: property.blockchainAddress,
    });
    const result = await web3Helper.ExecuteMethod(
      'SEND',
      web3Helper.contracts.Marketplace,
      'listProperty',
      [
        property.otherInfo.estateId,
        tokens,
        priceInWei,
        1,
        user.blockchainAddress,
        property.blockchainAddress,
      ]
    );
    if (result.error) {
      return handleError({
        res,
        err: result.message,
        statusCode: 500,
      });
    }

    web3Helper
      .ExecuteMethod(
        'SEND',
        web3Helper.contracts.Token,
        'customSetApprovalForAll',
        [user.blockchainAddress, web3Helper.Marketplace.options.address, false]
      )
      .then(() => {})
      .catch(logger.error);
    const ownerBalanceUpdatePromise = propertyBalanceModel
      .updateOne(
        { _user: user._id, _property: property._id },
        { $inc: { tokens: -tokens } }
      )
      .catch(logger.error);
    let txReceipt;
    // Set interval to regularly check if we can get a receipt
    await new Promise((resolve, reject) => {
      let pollCount = 0;
      const poller = () => {
        pollCount++;
        web3Helper.web3.eth.getTransactionReceipt(
          result.transactionHash,
          (_err, receipt) => {
            if (receipt) {
              txReceipt = receipt;
              resolve();
            } else {
              if (pollCount >= 20) return reject('Something went wrong.');
              setTimeout(poller, 3 * 1000);
            }
          }
        );
      };
      poller();
    });
    const listingId = web3Helper.web3.utils
      .toBN('0x' + txReceipt.logs[0].data.slice(-192, -128))
      .toString();

    const sellOrder = new orderModel({
      _property: property._id,
      listingId,
      sellerAddress: user.blockchainAddress,
      sellerId: user._id,
      tokenId: property.otherInfo.estateId,
      tokens,
    });
    await Promise.all([
      sellOrder.save(),
      propertyModel.findOneAndUpdate(
        { _id: property._id },
        { $set: { status: 'OnSale' } }
      ),
      ownerBalanceUpdatePromise,
    ]);

    // ? Commented for now will be undo later
    // await auth_sendEmail({
    //   email: '',
    //   type: 'PROPERTY',
    //   request: {
    //     startDate: property?.crowdsale?.startDate,
    //     mainImage: property?.images?.list[property?.images?.mainImage].url,
    //     property_name: property?.otherInfo?.title,
    //     city: property?.attom?.city,
    //     state: property?.attom?.state,
    //     perTokenPrice: pricePerToken,
    //     asset_value: property?.financials?.assetValue,
    //     gross_profit: property?.financials?.yearlyInvReturn,
    //     quote: property?.otherInfo?.quote,
    //     description: property?.otherInfo?.description,
    //     url: await config.baseUrl,
    //     marketplace_url: (await config.baseUrl) + '/marketplace',
    //     interestRate: property.otherInfo.interestRate,
    //     projectedInvGain: property.financials.projectedInvGain,
    //   },
    // });

    return handleResponse({ res, msg: messages.PUT_ON_SALE_SUCCESS });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const getComparableProperties = async (req, res) => {
  try {
    logger.info('Inside get comparable properties API controller');
    const comparableProperties = await getAllComparableProperties();

    if (comparableProperties?.error) {
      return handleError({ res, err: comparableProperties.error });
    }

    return handleResponse({
      res,
      msg: messages.COMPARABLE_LIST,
      data: comparableProperties,
    });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const propertyComparables = async (req, res) => {
  try {
    logger.info('Inside property comparables API controller');
    const { id } = req.params;
    const comparableProperties = await getAllComparablePropertiesByPropertyId(
      id
    );

    if (comparableProperties?.error) {
      return handleError({ res, err: comparableProperties.error });
    }

    return handleResponse({
      res,
      msg: messages.COMPARABLE_LIST,
      data: comparableProperties,
    });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const getComparableProperty = async (req, res) => {
  try {
    logger.info('Inside get comparable properties API controller');
    const { id } = req.params;

    const comparableProperty = await getComparablePropertyinDB(id);

    if (comparableProperty?.error) {
      return handleError({ res, err: comparableProperty.error });
    }

    return handleResponse({
      res,
      msg: messages.GET_COMPARABLE_PROPERTY,
      data: comparableProperty,
    });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const createComparableProperty = async (req, res) => {
  try {
    logger.info('Inside create comparable property API controller');
    const validation = comparablePropertyValidator(req.body);
    if (validation.error) {
      return handleError({ res, err: validation.message });
    }

    const comparableProperty = await createComparablePropertyInDB(req.body);

    return handleResponse({
      res,
      msg: messages.CREATE_COMPARABLE_PROPERTY,
      data: comparableProperty,
    });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const updateComparableProperty = async (req, res) => {
  try {
    logger.info('Inside update comparable property API controller');
    const validation = comparablePropertyValidator(req.body);
    if (validation.error) {
      return handleError({ res, err: validation.message });
    }

    const { id } = req.params;
    const comparableProperty = await updateComparablePropertyInDB(req.body, id);

    return handleResponse({
      res,
      msg: messages.UPDATE_COMPARABLE_PROPERTY,
      data: comparableProperty,
    });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const deleteComparableProperty = async (req, res) => {
  try {
    logger.info('Inside delete comparable property API controller');

    const { id } = req.params;
    await deleteComparablePropertyInDB(id);

    return handleResponse({
      res,
      msg: messages.DELETED_COMPARABLE_PROPERTY,
    });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const reservesTransactions = async (req, res) => {
  try {
    logger.info('Inside reserve transactions API controller');
    const { propertyId } = req.params;
    const { page, limit } = req.query;
    const property = await getPropertyDetails(propertyId);
    if (property?.error) {
      return handleError({ res, err: property.error });
    }
    const transactions = await getReservesTransaction(page, limit, property);
    if (transactions?.error) {
      return handleError({ res, err: transactions.error });
    }
    return handleResponse({
      res,
      msg: messages.RESERVES_TRANSACTIONS_LIST,
      data: transactions,
    });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const coowners = async (req, res) => {
  try {
    logger.info('Inside coowners API controller');
    const { propertyId } = req.params;
    const property = await getPropertyDetails(propertyId);
    if (property?.error) {
      return handleError({ res, err: property.error });
    }
    const list = await getCoowners(property._id);
    if (list?.error) {
      return handleError({ res, err: list.error });
    }
    return handleResponse({ res, msg: messages.COOWNERS_LIST, data: list });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const deleteMarket = async (req, res) => {
  try {
    logger.info('Inside delete market API controller');
    const { id } = req.params;
    const market = await getMarketByField(id, '_id');
    if (market?.error) {
      return handleError({ res, err: market.error });
    }
    if (!market) {
      return handleError({
        res,
        err: messages.MARKET_NOT_EXIST,
        statusCode: 400,
      });
    }
    const assignedProperty = await checkForMarketAssigned(market._id);
    if (assignedProperty?.error) {
      return handleError({ res, err: assignedProperty.error });
    }
    if (assignedProperty.length > 0) {
      return handleError({
        res,
        err: messages.MARKET_ASSIGNED_TO_PROPERTY,
        statusCode: 400,
      });
    }
    const marketDeleted = await deleteMarketDoc(market._id);
    if (marketDeleted?.error) {
      return handleError({ res, err: marketDeleted.error });
    }
    return handleResponse({ res, msg: messages.MARKET_DELETED });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const transferContractOwnership = async (req, res) => {
  try {
    logger.info('Inside transfer ownership API controller');
    const user = req.user;
    if (!user?.blockchainAddress) {
      return handleError({ res, err: messages.FORBIDDEN, statusCode: 400 });
    }
    const { ownershipTo } = req.body;
    const transfer = await transferOwnership(user, ownershipTo);
    if (transfer?.error) return handleError({ res, err: transfer.error });
    return transfer;
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const delistProperty = async (req, res) => {
  try {
    logger.info('Inside delist property API controller');
    const { propertyId: _property } = req.params;
    const { listingId } = req.body;
    const property = await propertyModel.findOne({
      _id: new ObjectId(_property),
    });
    if (!property) {
      return handleError({
        res,
        err: messages.PROPERTY_NOT_FOUND,
        statusCode: 400,
      });
    }
    const user = await userModel.findOne({
      _id: ObjectId(property.otherInfo._owner),
    });

    const result = await web3Helper.ExecuteMethod(
      'SEND',
      web3Helper.contracts.Marketplace,
      'deListProperty',
      [listingId, user.blockchainAddress]
    );
    if (result.error) {
      return handleError({
        res,
        err: result.message,
        statusCode: 500,
      });
    }
    return handleResponse({
      res,
      msg: `Property Delisted Id: ${listingId ?? 'NaN'}`,
    });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};

export const executeMigrationMint = async (req, res) => {
  try {
    logger.info('Inside execute migration mint API controller');
    await web3Helper.initializationPromise;
    await bridgeMintNewTokens();
    return handleResponse({ res });
  } catch (err) {
    logger.error(err.message);
    return handleError({ res, err: err.message });
  }
};
