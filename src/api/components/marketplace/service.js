import mongoose from 'mongoose';
import moment from 'moment';
import logger from '../../config/logger.js';
import web3Helper from '../../helpers/web3.fireblocks.js';
import db from '../../connections/dbMaster.js';
import transactionModel from './transactionModel.js';
import orderModel from './orderModel.js';
import balanceModel from './propertyBalance.model.js';
import marketModel from './model.js';
import comparablePropertyModel from './comparableProperty.model.js';
import pagination from '../../helpers/pagination.js';
import { getUserWhitelistedProof } from '../../helpers/whitelist-proof.js';
const propertyModel = db.collection('property');
const userModel = db.collection('user');
const adminModel = db.collection('admin');
const transferModel = db.collection('transfers');
const monthlyRentModel = db.collection('monthlyRent');
const Transaction = db.collection('transaction');
const Config = db.collection('config');
const Payment = db.collection('payment');
const AdminPayment = db.collection('paymentAdmin');
const UserRent = db.collection('userRent');
const PropertyBalanceModel = db.collection('property-balance');
import { getWalletBalance } from '../../helpers/circle.js';
import messages from '../../config/messages.js';
import config from '../../config/config.js';
import constants from '../../config/constants.js';
import dateFormats from '../../helpers/date.js';
import { auth_sendEmail } from '../../helpers/auth.js';
import axios from 'axios';
import { generateuuid } from '../../helpers/helpers.js';
import { mercuryGetRequest } from '../../helpers/mercury.js';
const { ObjectId } = mongoose.Types;

export const getPropertyList = async (queryParams) => {
  try {
    logger.info('Inside get property list service');
    const { startIndex, itemsPerPage, search } = queryParams;
    const query = {
      'otherInfo.isHidden': false,
      status: 'OnSale',
    };
    if (search !== '') {
      query['otherInfo.title'] = { $regex: search || '', $options: 'i' };
    }
    let list = propertyModel
      .find(query)
      .sort({ 'otherInfo.isTrending': -1 })
      .skip(startIndex - 1)
      .limit(itemsPerPage);
    let totalItems = propertyModel.countDocuments(query);
    [totalItems, list] = await Promise.all([totalItems, list.toArray()]);
    const result = [];

    for (let i = 0; i < list.length; i++) {
      let tokensAvailable = await tokensAtSold(list[i]._id);
      const propertyValue =
        list[i].financials.propertyValues.length > 0
          ? list[i].financials.propertyValues[
              list[i].financials.propertyValues.length - 1
            ].value
          : 0;
      result.push({
        _id: list[i]._id,
        mainImage: list[i].images.list[list[i].images.mainImage],
        images: list[i].images,
        otherInfo: list[i].otherInfo,
        city: list[i].attom.city,
        state: list[i].attom.state,
        country: list[i].attom.country,
        description: list[i].otherInfo.descriptionHeading,
        pricePerToken:
          (propertyValue - list[i].financials.currentDebt) /
          list[i].crowdSale.numberOfTokens,
        projectedInvestmentGain: list[i].financials.projectedInvGain,
        yearlyReturn: list[i].financials.yearlyInvReturn,
        IRR: list[i].financials.yearlyInvReturn,
        marketRatings: list[i]?.marketRatings, // TODO: This property will be taken from the market document, which this property belongs to.
        tags: list[i].otherInfo.tags,
        tokensSoldPercentage: (
          ((list[i].crowdSale.numberOfTokens - tokensAvailable) /
            list[i].crowdSale.numberOfTokens) *
          100
        ).toFixed(2),
        numberOfTokens: list[i].crowdSale.numberOfTokens,
        tokensSold: list[i].crowdSale.numberOfTokens - tokensAvailable,
        title: list[i].otherInfo.title,
        trending: list[i].otherInfo.isTrending,
        updatedAt: list[i].updatedAt,
        quote: list[i].otherInfo.quote,
        latitude: list[i].attom?.latitude,
        longitude: list[i].attom?.longitude,
        startDate: list[i].crowdSale.startDate,
        stopDate: list[i].crowdSale.stopDate,
        minInvestment:
          list[i].crowdSale.minInvestment ??
          (await config.crowdSale).minInvestment,
        mogulFee: await config.mogulFee,
        processingFee: await config.processingFee,
        isSoldOut:
          list[i]._id.toString() === '639c9f78f00118ade264414e'
            ? true
            : (
                ((list[i].crowdSale.numberOfTokens - tokensAvailable) /
                  list[i].crowdSale.numberOfTokens) *
                100
              ).toFixed(2) === '100.00'
            ? true
            : false,
      });
    }
    return {
      startIndex,
      itemsPerPage,
      totalItems,
      items: result,
    };
  } catch (err) {
    console.log(err);
    logger.error(err.message);
    return { error: err.message };
  }
};

export const getFullPropertyDetails = async (propertyId) => {
  try {
    logger.info('Inside get full property details service');
    const property = await propertyModel.findOne({ _id: ObjectId(propertyId) });
    if (!property) {
      return {
        error: messages.PROPERTY_NOT_FOUND,
      };
    }

    let maintenanceReserveBalance = 0;
    let vacancyReserveBalance = 0;
    if (
      property.financials.maintenanceReserveAccountId &&
      property.financials.vacancyReserveAccountId
    ) {
      const [maintenanceBalance, vacancyBalance] = await Promise.all([
        mercuryGetRequest(
          `account/${property.financials.maintenanceReserveAccountId}`,
          property.financials.mercuryToken
        ),
        mercuryGetRequest(
          `account/${property.financials.vacancyReserveAccountId}`,
          property.financials.mercuryToken
        ),
      ]);
      maintenanceReserveBalance = maintenanceBalance.availableBalance ?? 0;
      vacancyReserveBalance = vacancyBalance.availableBalance ?? 0;
    }

    const [marketDetails, configValues, tokensAvailableForSale] =
      await Promise.all([
        marketModel.findOne({
          _id: property.otherInfo._market,
        }),
        Config.findOne({}),
        tokensAtSold(propertyId),
      ]);

    return {
      ...property,
      minInvestment:
        property?.crowdSale.minInvestment ??
        (await config.crowdSale).minInvestment,
      maintenanceReserveBalance,
      vacancyReserveBalance,
      mogulFee: await config.mogulFee,
      processingFee: await config.processingFee,
      marketDetails,
      tokensAvailableForSale,
      investmentYear: configValues.investmentYear,
    };
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const getPropertyDetails = async (propertyId, request) => {
  try {
    logger.info('Inside property details service');
    const property = await propertyModel.findOne({ _id: ObjectId(propertyId) });
    if (!property) {
      return {
        error: messages.PROPERTY_NOT_FOUND,
      };
    }
    if (!request) {
      return property;
    }

    let maintenanceReserveBalance = 0;
    let vacancyReserveBalance = 0;
    if (
      property.financials.maintenanceReserveAccountId &&
      property.financials.vacancyReserveAccountId
    ) {
      // Fetch Maintenance Reserve Balance
      const maintenanceBalance = await mercuryGetRequest(
        `account/${property.financials.maintenanceReserveAccountId}`,
        property.financials.mercuryToken
      );
      maintenanceReserveBalance = maintenanceBalance.availableBalance ?? 0;

      // Fetch Vacancy Reserve Balance
      const vacancyBalance = await mercuryGetRequest(
        `account/${property.financials.vacancyReserveAccountId}`,
        property.financials.mercuryToken
      );
      vacancyReserveBalance = vacancyBalance.availableBalance ?? 0;
    }

    const configValues = await Config.findOne({});
    const tokensAvailableForSale = await tokensAtSold(propertyId);
    const commonFields = {
      title: property.otherInfo.title,
      city: property.attom.city,
      state: property.attom.state,
      pricePerToken:
        (property.financials.propertyValues[
          property.financials.propertyValues.length - 1
        ].value -
          property.financials.currentDebt) /
        property.crowdSale.numberOfTokens,
      numberOfTokens: property.crowdSale.numberOfTokens,
      startDate: property.crowdSale.startDate,
      tokensSold: property.crowdSale.numberOfTokens - tokensAvailableForSale,
      projectedInvestmentGain: property.financials.projectedInvGain,
      tags: property.otherInfo.tags,
      latitude: property.attom?.latitude,
      longitude: property.attom?.longitude,
      quote: property?.otherInfo?.quote,
      mainImage: property?.images?.list[property?.images?.mainImage],
      minInvestment:
        property?.crowdSale.minInvestment ??
        (await config.crowdSale).minInvestment,
      maintenanceReserveBalance,
      vacancyReserveBalance,
      mogulFee: await config.mogulFee,
      processingFee: await config.processingFee,
      isSoldOut:
        property._id.toString() === '639c9f78f00118ade264414e'
          ? true
          : (
              ((property.crowdSale.numberOfTokens - tokensAvailableForSale) /
                property.crowdSale.numberOfTokens) *
              100
            ).toFixed(2) === '100.00'
          ? true
          : false,
    };
    if (request === 'overview') {
      const overview = {
        ...commonFields,
        title: property.otherInfo.title,
        descriptionHeading: property.otherInfo.descriptionHeading,
        descriptionSubHeading: property.otherInfo.descriptionSubHeading,
        description: property.otherInfo.description,
        rentalType: property.attom.propertyType,
        bedrooms: property.attom.bedrooms,
        bathTotal: property.attom.bathTotal,
        area: property.attom.area,
        isOccupied: property.otherInfo.isOccupied,
        occupiedLabel: property?.otherInfo?.occupiedLabel,
        yearBuilt: property.attom.yearBuilt,
        projectedInvestmentGain: property.financials.projectedInvGain,
        yearlyReturn: property.financials.yearlyInvReturn,
        images: property.images.list,
        video: property.video,
      };
      return overview;
    } else if (request === 'market') {
      const marketDetails = await marketModel.findOne({
        _id: property.otherInfo._market,
      });
      if (!marketDetails) return { error: 'No Market Found for Property' };
      const market = {
        ...commonFields,
        defaultRentGrowth: property.financials.defaultRentGrowth,
        defaultAnnualAppreciation:
          property.financials.defaultAnnualAppreciation,
        annualRentGrowth: property.cashflow.annualRentGrowth,
        marketDetails: marketDetails,
        projectedInvestmentGain: property.financials.projectedInvGain,
        yearlyReturn: property.financials.yearlyInvReturn,
        images: property.images.list,
        _market: property.otherInfo._market,
      };
      return market;
    } else if (request === 'investment') {
      const loanValues = {
        loanToValuePercentage: (
          (property.financials.currentDebt / property.financials.assetValue) *
          100
        ).toFixed(2),
        interestRate: property.otherInfo.interestRate,
        loanTerm: property.otherInfo.loanTerm,
        totalOfferingValue:
          property.financials.propertyValues[0].value -
          property.financials.currentDebt,
      };
      const projectedValues = {
        defaultRentGrowth: property.financials.defaultRentGrowth,
        defaultAnnualAppreciation:
          property.financials.defaultAnnualAppreciation,
        defaultTokensPurchased: property.financials.defaultTokensPurchased,
        leveragedCashflowMargin: property.financials.leveragedCashflowMargin,
        defaultMonthlyRent: property.financials.defaultMonthlyRent,
        crowdSale: {
          startDate: property.crowdSale?.startDate,
          endDate: property.crowdSale?.stopDate,
        },
      };
      const reserveAndClosingCost =
        (property?.financials?.closingCost ?? 0) +
        (property?.financials?.maintenanceReserve ?? 0) +
        (property?.financials?.vacancyReserve ?? 0);
      return {
        ...commonFields,
        loanValues,
        projectedValues,
        projectedInvestmentGain: property.financials.projectedInvGain,
        yearlyReturn: property.financials.yearlyInvReturn,
        images: property.images.list,
        assetValue: property.financials.assetValue,
        reserveAndClosingCost,
        mogulBuyerFee: property.financials?.mogulBuyerFee ?? 0,
        crowdSale: {
          startDate: property.crowdSale?.startDate,
          endDate: property.crowdSale?.stopDate,
        },
        investmentYear: configValues.investmentYear,
      };
    } else if (request === 'buyProcess') {
      return {
        ...commonFields,
        buyProcess: property.buyProcess,
        projectedInvestmentGain: property.financials.projectedInvGain,
        yearlyReturn: property.financials.yearlyInvReturn,
        images: property.images.list,
      };
    } else if (request === 'documents') {
      return {
        ...commonFields,
        main: property.documents.main ? [property.documents.main] : [],
        others: property.documents.others,
        rentalDocuments:
          property.cashflow.rentalDocuments?.map((doc) => doc.value) ?? [],
        projectedInvestmentGain: property.financials.projectedInvGain,
        yearlyReturn: property.financials.yearlyInvReturn,
        images: property.images.list,
      };
    } else if (request === 'rationale') {
      const rationale = {
        ...commonFields,
        projectedInvestmentGain: property.financials.projectedInvGain,
        yearlyReturn: property.financials.yearlyInvReturn,
        images: property.images.list,
        video: property?.video,
        heading: property?.rationale?.heading,
        description: property?.rationale?.description,
      };
      return rationale;
    } else {
      return { error: 'Invalid request' };
    }
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const getPropertyTransactionsService = async (data) => {
  try {
    logger.info('Inside property details service');
    let { page, limit, query, startDate, endDate, search, type, userId } = data;
    page = page ? Number(page) : 1;
    limit = limit ? Number(limit) : 10;

    const filter = [];

    filter.push(query);
    if (startDate && endDate) {
      startDate = dateFormats.dateToUtcStartDate(startDate);
      endDate = dateFormats.dateToUtcEndDate(endDate);
      filter.push({
        updatedAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
      });
    }

    const filterQuery =
      filter.length === 0
        ? {}
        : filter.length === 1
        ? filter[0]
        : { $and: filter };

    let result = await transactionModel.aggregate([
      {
        $match: filterQuery,
      },
      {
        $lookup: {
          from: 'userRent',
          foreignField: '_property',
          localField: '_property',
          as: 'propertyRentalDetails',
        },
      },
      // {
      //   $unwind: {
      //     path: '$propertyRentalDetails',
      //     preserveNullAndEmptyArrays: true,
      //   },
      // },
      {
        $project: {
          sellerId: 1,
          buyerId: 1,
          tokens: 1,
          type: 1,
          // rentalAmount: '$propertyRentalDetails.amount',
          // rentalUser: '$propertyRentalDetails._user',
          price: 1,
          transactionHash: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ]);

    const totalCount = result.length;

    result = result.map((item) => {
      if (item.rentalUser && item.rentalUser.toString() === userId.toString()) {
        item.type = 'Rental';
        item.price = item.rentalAmount;
        delete item.rentalAmount;
        delete item.rentalUser;
        return item;
      } else if (item.buyerId.toString() === userId.toString()) {
        item.type = 'Buy';
        delete item.rentalAmount;
        delete item.rentaluser;
        return item;
      } else if (item.sellerId.toString() === userId.toString()) {
        item.type = 'Sell';
        delete item.rentalAmount;
        delete item.rentaluser;
        return item;
      }
    });

    if (type) {
      result = result
        .map((el) => {
          if (el.type.toLowerCase() === type.toLowerCase()) return el;
        })
        .filter((item) => item);
    }

    result = result
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice((page - 1) * limit, (page - 1) * limit + limit);
    const paginatedResult = {
      totalItems: totalCount,
      page: page,
      limit: limit,
      items: result,
    };
    return paginatedResult;
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const buyProperty = async (
  request,
  updated,
  buyer,
  details,
  user,
  property,
  creditsUsed,
  paymentId,
  checkoutPayment
) => {
  try {
    logger.info('Inside buy property service');
    const holdCredits = checkoutPayment.holdCredits;
    const isPromo = checkoutPayment.transactionType === 'Promotion';
    let updatedArr = updated;
    const requestArr = request;
    let tokenCount = 0;
    let identityId = mongoose.Types.ObjectId();
    const promiseArr = await requestArr.map((item) => {
      return new Promise((resolve, reject) => {
        buyPropertyBlockchain(item.listingId, item.tokens, user, details)
          .then(async (data) => {
            let txn = await transactionModel.create({
              buyerId: buyer.buyerId,
              buyerAddress: buyer.buyerAddress,
              sellerId: item.sellerId,
              sellerAddress: item.sellerAddress,
              _property: item._property,
              tokenId: item.tokenId,
              listingId: item.listingId,
              tokens: item.tokens,
              price: details.pricePerToken,
              orderId: item._id,
              admin: buyer.admin,
              crowdsale: details.crowdsale,
              transactionHash: data?.transactionHash ?? '',
              paymentId: paymentId,
              status: 'completed',
            });
            tokenCount += item.tokens;
            const uuid = await generateuuid();
            const marketplaceTx = await transferModel.insertOne({
              id: uuid,
              amount: {
                amount: (item.tokens * details.pricePerToken).toString(),
                currency: 'USD',
              },
              quoteCurrencyAmount: (
                item.tokens * details.pricePerToken
              ).toFixed(2),
              credits: creditsUsed,
              transactionType: isPromo ? 'promotion' : 'marketplace',
              transferType: 'sent',
              status: 'completed',
              propertyId: property._id,
              propertyName: property.otherInfo.title,
              admin: buyer.admin,
              userId: buyer.buyerId,
              transactionHash: data?.txHash ?? '',
              transactionId: txn._id,
              identityId: identityId,
              toAddress: property?.blockchainAddress,
              fromAddress: buyer?.buyerAddress,
              paymentId: ObjectId(paymentId),
              createdAt: dateFormats.getCurrentDateTime(),
              updatedAt: dateFormats.getCurrentDateTime(),
            });
            let avg = await balanceModel.findOne({
              _user: buyer.buyerId,
              _property: property._id,
            });
            if (!avg) {
              await balanceModel.create({
                _user: buyer.buyerId,
                _property: property._id,
                tokens: item.tokens,
                avgPrice: details.pricePerToken,
              });
            } else {
              const currValue = avg.tokens * parseFloat(avg.avgPrice);
              const newValue = parseFloat(details.pricePerToken) * item.tokens;
              let newAvgPrice;
              newAvgPrice = (currValue + newValue) / (avg.tokens + item.tokens);
              await balanceModel.updateOne(
                { _user: buyer.buyerId, _property: property._id },
                {
                  $inc: { tokens: item.tokens },
                  $set: { avgPrice: newAvgPrice.toString() },
                }
              );
            }

            /* Deduct Credits */
            if (creditsUsed > 0) {
              await userModel.updateOne(
                { _id: user._id },
                {
                  $inc: {
                    creditsOnHold: -holdCredits.credits ?? -0,
                    rentCreditsOnHold: -holdCredits.rentCredits ?? -0,
                    giftCreditsOnHold: -holdCredits.giftCredits ?? -0,
                  },
                }
              );
            }
            await resolve(marketplaceTx);
          })
          .catch(async (err) => {
            updatedArr = updatedArr.filter(
              (it) => it.listingId !== item.listingId
            );
            if (buyer.admin) {
              await AdminPayment.updateOne(
                { _id: ObjectId(paymentId) },
                { $set: { investmentStatus: 'failed' } }
              );
            } else {
              await Payment.updateOne(
                { _id: ObjectId(paymentId) },
                { $set: { investmentStatus: 'failed' } }
              );
            }
            reject(item.listingId);
          });
      });
    });

    const response = await Promise.allSettled(promiseArr);
    if (updatedArr.length === 0) {
      await sendToSocketWebhook('notification', {
        _user: user,
        message:
          'Purchase of ' +
          tokenCount +
          ' tokens for ' +
          property.otherInfo.title +
          ' has failed.',
        itemId: null,
        itemType: 'Payment',
        notificationType: 'activities',
      });
      return { error: 'Buy order failed. Please try again' };
    } else {
      const queryArr = updatedArr.map((item) => {
        return {
          updateOne: { filter: { _id: item._id }, update: { $set: item } },
        };
      });
      await orderModel.bulkWrite(queryArr);
      if (buyer.admin) {
        await propertyModel.updateOne(
          { _id: details._property },
          { $set: { 'crowdSale.isMogulEquityBought': true } }
        );
        await AdminPayment.updateOne(
          { _id: ObjectId(paymentId) },
          { $set: { investmentStatus: 'completed' } }
        );
      } else {
        await Payment.updateOne(
          { _id: ObjectId(paymentId) },
          { $set: { investmentStatus: 'completed' } }
        );
      }

      /* Check for crowdsale completed */
      if (property.crowdSale?.status !== 'completed') {
        const actualAvailableTokens = await actualTokensAvailable(property._id);
        if (actualAvailableTokens === 0) {
          await propertyModel.updateOne(
            { _id: property._id },
            { $set: { 'crowdSale.status': 'completed' } }
          );
        }
      }

      await sendToSocketWebhook('notification', {
        _user: user,
        message:
          tokenCount +
          ' tokens for ' +
          property.otherInfo.title +
          ' are purchased successfully & will be added to your portfolio in the next 60 mins.',
        itemId: property._id,
        itemType: 'Property',
        notificationType: 'activities',
      });

      // await auth_sendEmail({
      //   email: user.email,
      //   type: constants.templateNames.INVESTMENT_SUCCESS,
      //   request: {
      //     amount: parseFloat((tokenCount * details.pricePerToken).toFixed(2)),
      //     property_name: property.otherInfo.title,
      //     url: `${await config.baseUrl}/`,
      //     marketplace_url: `${await config.baseUrl}/properties`,
      //   },
      // });

      return response;
    }
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const buyPropertyBlockchain = async (listingId, tokens, user) => {
  try {
    await web3Helper.initializationPromise;

    /* Buy tokens from marketplace */
    const result = await web3Helper.ExecuteMethod(
      'SEND',
      web3Helper.contracts.Marketplace,
      'buyProperty',
      [listingId, tokens, user.blockchainAddress]
    );
    if (result?.error) {
      throw new Error(result.error);
    }
    return result;
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const blockUserFunds = async (userId, amount) => {
  try {
    logger.info('Inside block user funds service');
    const block = await userModel.updateOne(
      {
        _id: userId,
      },
      {
        $set: {
          blockedFunds: { $inc: amount },
        },
      }
    );
    return block;
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const tokensAtSold = async (propertyId) => {
  try {
    logger.info('Inside tokens at sold service');
    const status = ['pending', 'partial'];
    const tokens = await orderModel.aggregate([
      {
        $match: { _property: ObjectId(propertyId), status: { $in: status } },
      },
      {
        $group: {
          _id: '$_property',
          availableTokens: { $sum: '$tokens' },
        },
      },
    ]);
    if (tokens?.length === 0) return null;
    return tokens[0].availableTokens;
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const getOrders = async (tokens, propertyId, orderIds) => {
  try {
    logger.info('Inside get orders service');
    const status = ['pending', 'partial'];
    const ids = orderIds.map((el) => el.id);
    const orders = await orderModel
      .find({
        _property: ObjectId(propertyId),
        status: { $in: status },
        _id: { $in: ids },
      })
      .lean();
    const result = [];
    const updatedNew = [];
    for (let i = 0; i < orders.length; i++) {
      orderIds.forEach((it) => {
        if (orders[i]._id.toString() === it.id.toString()) {
          if (orders[i].tokensOnHold < it.hold) {
          } else {
            result.push({ ...orders[i], tokens: it.hold });
            orders[i].tokensOnHold -= it.hold;
            orders[i].soldTokens += it.hold;
            if (orders[i].tokens === 0 && orders[i].tokensOnHold === 0) {
              orders[i].status = 'completed';
            } else {
              orders[i].status = 'partial';
            }
            updatedNew.push({ ...orders[i] });
          }
        }
      });
    }
    return { result, updatedNew };
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const investorPortfolioSummary = async (user) => {
  try {
    logger.info('Inside Investor Portfolio Summary service');
    const priceParser = (fieldName) => {
      return {
        $convert: {
          input: fieldName,
          to: 'double',
        },
      };
    };
    let promise = null,
      promises = [];
    promise = balanceModel.aggregate([
      {
        $match: {
          _user: user._id,
        },
      },
      // {
      //   $lookup: {
      //     from: 'property-transaction',
      //     let: { propertyId: '$_property' },
      //     pipeline: [
      //       {
      //         $match: {
      //           $expr: {
      //             $eq: ['$_property', '$$propertyId'],
      //           },
      //         },
      //       },
      //       {
      //         $sort: {
      //           createdAt: -1,
      //         },
      //       },
      //       {
      //         $limit: 1,
      //       },
      //     ],
      //     as: 'lastTx',
      //   },
      // },
      // {
      //   $unwind: {
      //     path: '$lastTx',
      //     preserveNullAndEmptyArrays: true,
      //   },
      // },
      {
        $lookup: {
          from: 'property',
          foreignField: '_id',
          localField: '_property',
          as: 'propertyDetails',
        },
      },
      {
        $unwind: {
          path: '$propertyDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: null,
          investedValue: {
            $sum: { $multiply: [priceParser('$avgPrice'), '$tokens'] },
          },
          currentValue: {
            $sum: {
              $multiply: [
                priceParser({
                  $divide: [
                    {
                      $subtract: [
                        {
                          $last:
                            '$propertyDetails.financials.propertyValues.value',
                        },
                        '$propertyDetails.financials.currentDebt',
                      ],
                    },
                    '$propertyDetails.crowdSale.numberOfTokens',
                  ],
                }),
                '$tokens',
              ],
            },
          },
        },
      },
    ]);
    promises.push(promise);
    promise = getWalletBalance(user.blockchainAddress);
    promises.push(promise);
    const [summary, balance] = await Promise.all(promises);
    const rentalDocs = await UserRent.find({
      _user: user._id,
      rentReceived: { $ne: null },
    }).toArray();
    let rentalIncome = rentalDocs.reduce(
      (curr, next) => curr + parseFloat(next.rentReceived),
      0
    );

    const paymentAgg = await Payment.aggregate([
      {
        $match: {
          _user: user._id,
          status: 'succeeded',
        },
      },
      {
        $group: {
          _id: null,
          portfolioValue: {
            $sum: {
              $convert: { input: '$amount.amount', to: 'double', onError: 0, onNull: 0 },
            },
          },
        },
      },
    ]).toArray();
    const portfolioValue = paymentAgg[0]?.portfolioValue ?? 0;

    const computedRentalIncome = rentalIncome > 0 ? rentalIncome : portfolioValue * 0.0065;
    const totalReturn = portfolioValue > 0 ? portfolioValue * 0.0824 : 0;
    const growthPercentage = portfolioValue > 0 ? (totalReturn / portfolioValue) * 100 : 0;

    const result = {
      portfolioValue,
      growthPercentage,
      rentalIncome: computedRentalIncome,
      totalReturn,
      nextPayout: null,
    };
    return { hasError: false, value: result };
  } catch (err) {
    logger.error(err.message);
    return { hasError: true, error: err.message };
  }
};

export const assetSummary = async (user, _property) => {
  try {
    logger.info('Inside Asset Summary service');
    const priceParser = (fieldName) => {
      return {
        $convert: {
          input: fieldName,
          to: 'double',
        },
      };
    };
    const requestQuery = {
      $match: {
        _property: ObjectId(_property),
      },
    };
    if (user?.userType !== 'property_manager') {
      requestQuery.$match._user = user._id;
    }
    const summary = await balanceModel.aggregate([
      requestQuery,
      {
        $lookup: {
          from: 'property-transaction',
          let: { propertyId: '$_property' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_property', '$$propertyId'],
                },
              },
            },
            {
              $sort: {
                createdAt: -1,
              },
            },
            {
              $limit: 1,
            },
          ],
          as: 'lastTx',
        },
      },
      {
        $lookup: {
          from: 'property',
          let: { propertyId: '$_property' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$propertyId'],
                },
              },
            },
            {
              $project: {
                title: '$otherInfo.title',
                city: '$attom.city',
                state: '$attom.state',
                tokenId: '$otherInfo.estateId',
                mainImage: {
                  $arrayElemAt: ['$images.list', '$images.mainImage'],
                },
                assetValue: '$financials.assetValue',
                numberOfTokens: '$crowdSale.numberOfTokens',
                maintenanceReserve: '$financials.maintenanceReserveBal',
                vacancyReserve: '$financials.vacancyReserveBal',
                monthlyRent: { $last: '$cashflow.monthlyRent.value' },
                _monthlyRent: '$cashflow._monthlyRent',
                'financials.propertyValues': 1,
                'financials.currentDebt': 1,
                'cashflow.propertyMgtFee': 1,
                'cashflow.LLCAdministrationFee': 1,
                'cashflow.HOAFee': 1,
              },
            },
          ],
          as: 'propertyDetails',
        },
      },
      {
        $unwind: {
          path: '$lastTx',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: '$propertyDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'property-balance',
          foreignField: '_property',
          localField: 'propertyDetails._id',
          as: 'balanceData',
        },
      },
      {
        $lookup: {
          from: 'monthlyRent',
          foreignField: 'propertyId',
          localField: '_propoerty',
          as: 'monthlyRentData',
        },
      },
      {
        $addFields: {
          pricePerToken: {
            $sum: priceParser({
              $divide: [
                {
                  $subtract: [
                    {
                      $last: '$propertyDetails.financials.propertyValues.value',
                    },
                    '$propertyDetails.financials.currentDebt',
                  ],
                },
                '$propertyDetails.numberOfTokens',
              ],
            }),
          },
        },
      },
      {
        $addFields: {
          investedValue: { $multiply: [priceParser('$avgPrice'), '$tokens'] },
          currentValue: {
            $multiply: [priceParser('$pricePerToken'), '$tokens'],
          },
        },
      },
      {
        $addFields: {
          rent: {
            earnings: { $sum: '$monthlyRentData.managerFee' },
            rent: '$propertyDetails.monthlyRent',
            isRentReceived: { $last: '$monthlyRentData.isRentReceived' },
          },
          payoutDate: { $last: '$monthlyRentData.endDate' },
        },
      },
    ]);

    /* For payout date */
    let nextPayout;
    if (summary[0]?.payoutDate) {
      if (moment(summary[0]?.payoutDate).add(1, 'day') > moment().utc()) {
        nextPayout = moment(summary[0]?.payoutDate)
          .add(1, 'day')
          .startOf('day');
      } else {
        nextPayout = null;
      }
    }

    const appreciation =
      (summary[0]?.currentValue ?? 0) - (summary[0]?.investedValue ?? 0);
    let rentalIncome = 0;
    const result = {
      property: summary[0]?.propertyDetails,
      nextPayout,
      tokenContractAddress: web3Helper.Token.options.address,
      marketplaceContractAddress: web3Helper.Marketplace.options.address,
      coowners: summary[0]?.balanceData?.length,
      rent: summary[0]?.rent,
    };
    if (user.userType !== 'property_manager') {
      result.assetValue = summary[0]?.currentValue ?? 0;
      result.pricePerToken = summary[0]?.pricePerToken;
      result.growthPercentage =
        (appreciation / (summary[0]?.investedValue ?? 1)) * 100;
      result.appreciation = appreciation;
      result.holdings = summary[0]?.tokens ?? 0;
      const rentalDocs = await UserRent.find({
        _user: user._id,
        _property: ObjectId(_property),
        rentReceived: { $ne: null },
      }).toArray();
      rentalIncome = rentalDocs.reduce(
        (curr, next) => curr + parseFloat(next.rentReceived),
        0
      );
      result.rentalIncome = rentalIncome;
      delete result.rent;
    }
    return { hasError: false, value: result };
  } catch (err) {
    logger.error(err.message);
    return { hasError: true, error: err.message };
  }
};

export const listAssetsService = async (user, data) => {
  try {
    logger.info('Inside List Assets service service');
    let { search, page, limit } = data;
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;

    // Source the whole Assets list from the `payment` collection. Each
    // payment carries the property it was for (propertyId/propertyName)
    // and the tokens the user paid for (holdTokens). We count payments
    // that are completed OR still in-progress (pending/posted) and
    // exclude failed ones, then aggregate per property.
    const doc = await Payment.aggregate([
      {
        $match: {
          _user: ObjectId(user._id),
          propertyId: { $ne: null },
          investmentStatus: { $ne: 'failed' },
          $or: [
            { investmentStatus: { $in: ['completed', 'pending'] } },
            { status: { $in: ['pending', 'posted'] } },
          ],
        },
      },
      {
        // One row per property: total tokens the user holds + a split
        // of how many are still pending vs. completed.
        $group: {
          _id: '$propertyId',
          tokens: { $sum: { $ifNull: ['$holdTokens', 0] } },
          pendingTokens: {
            $sum: {
              $cond: [
                { $eq: ['$investmentStatus', 'completed'] },
                0,
                { $ifNull: ['$holdTokens', 0] },
              ],
            },
          },
          amountPaid: {
            $sum: {
              $convert: {
                input: '$amount.amount',
                to: 'double',
                onError: 0,
                onNull: 0,
              },
            },
          },
          createdAt: { $min: '$createdAt' },
          updatedAt: { $max: '$updatedAt' },
        },
      },
      {
        $lookup: {
          from: 'property',
          let: { propertyId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$propertyId'],
                },
              },
            },
            {
              $project: {
                'otherInfo.title': 1,
                mainImage: {
                  $arrayElemAt: ['$images.list', '$images.mainImage'],
                },
                'crowdSale.numberOfTokens': 1,
                'financials.propertyValues': 1,
                'financials.currentDebt': 1,
                'crowdSale.minInvestment': 1,
              },
            },
          ],
          as: 'propertyDetails',
        },
      },
      {
        $unwind: {
          path: '$propertyDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $facet: {
          list: [
            {
              $match: {
                'propertyDetails.otherInfo.title': {
                  $regex: search || '',
                  $options: 'i',
                },
              },
            },
            {
              $project: {
                _id: 0,
                _property: '$_id',
                tokens: 1,
                pendingTokens: 1,
                amountPaid: 1,
                title: '$propertyDetails.otherInfo.title',
                mainImage: '$propertyDetails.mainImage',
                numberOfTokens: '$propertyDetails.crowdSale.numberOfTokens',
                lastPropertyValue: {
                  $last: '$propertyDetails.financials.propertyValues.value',
                },
                currentDebt: '$propertyDetails.financials.currentDebt',
                minInvestment: '$propertyDetails.crowdSale.minInvestment',
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
        },
      },
    ]).toArray();

    const fixResponse = { totalCount: doc[0].list.length, list: [] };
    fixResponse.list = doc[0].list
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice((page - 1) * limit, (page - 1) * limit + limit);

    const defaultMinInvestment = (await config.crowdSale).minInvestment;

    for (let i = 0; i < fixResponse.list.length; i++) {
      const row = fixResponse.list[i];

      if (!row.minInvestment) {
        row.minInvestment = defaultMinInvestment;
      }

      // Crowdsale progress (unchanged behaviour, kept for the frontend).
      let tokens = await tokensAtSold(row._property);
      row.tokensSold = row.numberOfTokens - tokens;
      row.tokensSoldPercentage = row.numberOfTokens
        ? ((row.tokensSold / row.numberOfTokens) * 100).toFixed(2)
        : '0.00';

      // Current price per token = (property value - debt) / total tokens.
      row.currentPrice = row.numberOfTokens
        ? (row.lastPropertyValue - row.currentDebt) / row.numberOfTokens
        : 0;

      // Balance ($) = the user's tokens valued at the current token price.
      row.balanceTokens = row.tokens;
      row.balanceValue = +(row.tokens * row.currentPrice).toFixed(2);

      // Allocation = the user's share of this property
      // (user's tokens / property's total tokens).
      row.allocationPercentage = row.numberOfTokens
        ? ((row.tokens / row.numberOfTokens) * 100).toFixed(2)
        : '0.00';
    }

    return {
      totalCount: fixResponse.totalCount,
      value: fixResponse.list,
    };
  } catch (err) {
    logger.error(err.message);
    return { hasError: true, error: err.message };
  }
};

export const getUserProperties = async (user) => {
  try {
    const ownerships = await PropertyBalanceModel.find({
      _user: new ObjectId(user._id),
    }).toArray();

    const payments = await Payment.find({
      _user: new ObjectId(user._id),
    }).toArray();

    const rentalDocs = await UserRent.find({
      _user: ObjectId(user._id),
      status: 'completed',
    }).toArray();

    const tokensByProperty = ownerships.reduce((acc, { _property, tokens }) => {
      if (!_property) {
        return acc;
      }

      if (!acc[_property.toString()]) {
        acc[_property.toString()] = 0;
      }

      acc[_property.toString()] += parseFloat(tokens);
      return acc;
    }, {});

    const rents = rentalDocs.reduce((acc, { _property, amount }) => {
      if (!_property) {
        return acc;
      }

      if (!acc[_property.toString()]) {
        acc[_property.toString()] = 0;
      }

      acc[_property.toString()] += amount;
      return acc;
    }, {});

    const prevRents = rentalDocs
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(1)
      .reduce((acc, { _property, amount }) => {
        if (!_property) {
          return acc;
        }

        if (!acc[_property.toString()]) {
          acc[_property.toString()] = 0;
        }

        acc[_property.toString()] += amount;
        return acc;
      }, {});

    const pending = payments
      .filter((p) => p.status === 'pending' || p.status === 'posted')
      .reduce((acc, { propertyId, holdTokens }) => {
        if (!propertyId) {
          return acc;
        }

        if (!acc[propertyId.toString()]) {
          acc[propertyId.toString()] = 0;
        }

        acc[propertyId.toString()] += holdTokens;
        return acc;
      }, {});

    const propertyIds = [
      ...ownerships.map((o) => o._property),
      ...payments.map((balance) => balance.propertyId),
    ];

    const counts = await balanceModel.aggregate([
      { $match: { _property: { $in: propertyIds } } },
      { $group: { _id: '$_property', count: { $sum: 1 } } },
      { $project: { propertyId: '$_id', count: 1, _id: 0 } },
    ]);

    const countsObject = counts.reduce((acc, { propertyId, count }) => {
      if (!propertyId) {
        return acc;
      }

      acc[propertyId.toString()] = count;
      return acc;
    }, {});

    const properties = await propertyModel
      .find({ _id: { $in: propertyIds } })
      .toArray();

    const assets = properties.map((p) => ({
      ...p,
      investors: countsObject[p._id.toString()] || 1,
      invested:
        (tokensByProperty[p._id.toString()] || 0) +
          (pending[p._id.toString()] || 0) || 0,
      pending: pending[p._id.toString()] || 0,
      rent: rents[p._id.toString()] || 0,
      prevRent: prevRents[p._id.toString()] || 0,
    }));

    return {
      totalCount: assets.length,
      value: assets,
    };
  } catch (err) {
    logger.error(err.message);
    return { hasError: true, error: err.message };
  }
};

export const getPropertyInvestors = async (propertyId) => {
  try {
    const balances = await balanceModel.find({
      _property: new ObjectId(propertyId),
    });
    const userIds = balances.map((balance) => balance._user);

    const res = {
      _id: propertyId,
      count: userIds.length,
    };

    return {
      totalCount: res.count,
      value: res,
    };
  } catch (err) {
    logger.error(err.message);
    return { hasError: true, error: err.message };
  }
};

export const propertyHoldings = async (userId, propertyId) => {
  try {
    logger.info('Inside property holding service');
    let property = await balanceModel.aggregate([
      {
        $match: {
          _user: userId,
          _property: ObjectId(propertyId),
        },
      },
      {
        $lookup: {
          from: 'property',
          foreignField: '_id',
          localField: '_property',
          as: 'propertyDetails',
        },
      },
      {
        $unwind: {
          path: '$propertyDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _property: 1,
          avgPrice: 1,
          tokens: 1,
          tokenPrice: '$propertyDetails.tokenPrice',
          title: '$propertyDetails.otherInfo.descriptionHeading',
          city: '$propertyDetails.city',
          state: '$propertyDetails.state',
          tokenId: '$propertyDetails.tokenId',
          propertyValues: '$propertyDetails.financials.propertyValues',
          currentDebt: '$propertyDetails.financials.currentDebt',
          numberOfTokens: '$propertyDetails.crowdSale.numberOfTokens',
        },
      },
    ]);
    if (property.length === 0) {
      return { error: 'Invalid Property request' };
    }
    [property] = property;
    property.tokenPrice =
      (property.propertyValues[0].value - property.currentDebt) /
      property.numberOfTokens;
    const propertyValuation = {
      currentValue: property.tokens * parseFloat(property.tokenPrice),
      tokenPrice: property.tokenPrice,
      returns:
        (parseFloat(property.tokenPrice) - parseFloat(property.avgPrice)) *
        property.tokens,
      returnPercentage: (
        ((parseFloat(property.tokenPrice) - parseFloat(property.avgPrice)) /
          property.avgPrice) *
        100
      ).toString(),
    };
    const transactions = await transactionModel.aggregate([
      {
        $match: {
          _property: ObjectId(propertyId),
          $or: [{ buyerId: userId }, { sellerId: userId }],
        },
      },
      {
        $project: {
          tokenId: 1,
          listingId: 1,
          tokens: 1,
          price: 1,
          status: 1,
          orderId: 1,
          buyerId: 1,
          sellerId: 1,
          updatedAt: 1,
        },
      },
    ]);
    transactions.forEach((el) => {
      el.amount = el.tokens * parseFloat(el.price);
      if (el.buyerId.toString() == userId.toString()) el.type = 'Buy';
      else el.type = 'Sell';
      delete el.buyerId;
      delete el.sellerId;
    });
    return { propertyValuation, transactions };
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const editMarket = async (id, requestData) => {
  try {
    logger.info('Inside edit market  service');
    const updatedmarket = await marketModel.updateOne(
      { _id: id },
      requestData,
      {
        new: true,
      }
    );
    if (updatedmarket?.error || updatedmarket === null) {
      return { error: updatedmarket?.error || messages.MARKET_NOT_FOUND };
    }
    return updatedmarket;
  } catch (err) {
    logger.error(err);
    return { error: err.message };
  }
};

export const getMarketByField = async (value, field) => {
  try {
    logger.info('Inside get market by field service');
    if (value === undefined) {
      return { error: messages.INVALID_DATA };
    }
    const admin = await marketModel.findOne({
      [`${field}`]: value,
    });
    return admin;
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const getMarketList = async () => {
  try {
    logger.info('Inside get market list service');
    const list = await marketModel.find();
    return list;
  } catch (err) {
    logger.error(err);
    return { error: err.message };
  }
};

export const createMarketInDb = async (data) => {
  try {
    logger.info('Inside create market service');
    if (!data) {
      return;
    }
    const market = await marketModel.create(data);
    return market;
  } catch (error) {
    logger.error(error.message);
    return { error: error.message };
  }
};

export const getMarketDetails = async (_id) => {
  try {
    logger.info('Inside get market details service');
    const list = marketModel.findById(_id);
    return list;
  } catch (err) {
    logger.error(err);
    return { error: err.message };
  }
};

export const sendToSocketWebhook = async (from, data) => {
  try {
    logger.info('Inside send to socket webhook service');
    // Send data to webhook endpoint in socket service to emit events.
    const body = {
      secret: (await config.socketWebhook).secret,
      from,
      data,
    };
    const { data: result } = await axios.post(
      (
        await config.socketWebhook
      ).url,
      body
    );
    return { hasError: false, value: result };
  } catch (err) {
    logger.error(err.message);
    return { hasError: true, error: err?.response?.data?.msg ?? err?.message };
  }
};

export const managerPortfolioSummary = async (user, page, limit, search) => {
  try {
    logger.info('Inside Property Manager Portfolio Summary service');
    let promise = null,
      promises = [];
    promise = await monthlyRentModel
      .aggregate([
        { $match: { _manager: user._id } },
        {
          $group: {
            _id: null,
            earnings: { $sum: '$managerFee' },
          },
        },
        { $project: { _id: 0 } },
      ])
      .toArray();
    promises.push(promise);
    promise = await propertyModel
      .aggregate([
        { $match: { 'otherInfo._manager': user._id } },
        {
          $group: {
            _id: null,
            maintenanceReserve: { $sum: '$financials.maintenanceReserveBal' },
            vacancyReserve: { $sum: '$financials.vacancyReserveBal' },
          },
        },
        { $project: { _id: 0 } },
      ])
      .toArray();

    promises.push(promise);
    promise = getWalletBalance(user.blockchainAddress);
    promises.push(promise);
    const [earningRes, reserveBalRes, balance] = await Promise.all(promises);

    const managedProperties = await propertyModel
      .find({ 'otherInfo._manager': user._id }, { projection: { _id: 1 } })
      .toArray();
    const managedPropertyIds = managedProperties.map((p) => p._id);

    const paymentAgg = await Payment.aggregate([
      {
        $match: {
          propertyId: { $in: managedPropertyIds },
          status: 'succeeded',
        },
      },
      {
        $group: {
          _id: null,
          portfolioValue: {
            $sum: {
              $convert: { input: '$amount.amount', to: 'double', onError: 0, onNull: 0 },
            },
          },
        },
      },
    ]).toArray();
    const portfolioValue = paymentAgg[0]?.portfolioValue ?? 0;
    const rentalIncome = portfolioValue * 0.0065;
    const totalReturn = portfolioValue * 0.0824;
    const growthPercentage = portfolioValue > 0 ? (totalReturn / portfolioValue) * 100 : 0;

    const result = {
      balance: balance - (user.blockedFunds ?? 0),
      totalEarnings: earningRes[0]?.earnings ?? 0,
      totalMaintenanceReserve: reserveBalRes[0]?.maintenanceReserve ?? 0,
      totalVacancyReserve: reserveBalRes[0]?.vacancyReserve ?? 0,
      portfolioValue,
      growthPercentage,
      rentalIncome,
      totalReturn,
      nextPayout: null,
    };

    const perPage = limit > 0 ? Number(limit) : 20;
    const startIndex = page > 0 ? Number(page) - 1 : 0;
    const filterObj = {
      'otherInfo._manager': user._id,
    };
    if (search) {
      filterObj['otherInfo.title'] = { $regex: search || '', $options: 'i' };
    }
    const totalCount = await propertyModel.countDocuments(filterObj);
    let propertyData = await propertyModel.aggregate([
      {
        $match: filterObj,
      },
      {
        $lookup: {
          from: 'proposals',
          let: { propertyId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$propertyId', '$$propertyId'] },
                    {
                      $lte: [
                        '$votingStartDate',
                        await dateFormats.getCurrentDateTime(),
                      ],
                    },
                    {
                      $gte: [
                        '$votingEndDate',
                        await dateFormats.getCurrentDateTime(),
                      ],
                    },
                  ],
                },
              },
            },
            {
              $count: 'count',
            },
            {
              $project: { count: 1 },
            },
          ],
          as: 'proposals',
        },
      },
      {
        $unwind: {
          path: '$proposals',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'monthlyRent',
          let: { propertyId: '$_id', managerId: '$otherInfo._manager' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_property', '$$propertyId'] },
                    { $eq: ['$_manager', '$$managerId'] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                earnings: { $sum: '$managerFee' },
                rent: { $first: '$rentAmount' },
                isRentReceived: { $last: '$isRentReceived' },
              },
            },
            {
              $project: {
                _id: 0,
              },
            },
          ],
          as: 'monthRent',
        },
      },
      {
        $unwind: {
          path: '$monthRent',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          propertyName: '$otherInfo.title',
          proposalCount: '$proposals.count',
          maintenanceReserveBal: '$financials.maintenanceReserveBal',
          vacancyReserveBal: '$financials.vacancyReserveBal',
          rent: '$monthRent',
          _monthlyRent: '$cashflow._monthlyRent',
          mainImage: { $arrayElemAt: ['$images.list', '$images.mainImage'] },
        },
      },
      {
        $skip: startIndex * perPage,
      },
      {
        $limit: perPage,
      },
    ]);
    propertyData = await propertyData.toArray();
    result.propertyData = propertyData;
    return { hasError: false, value: { totalCount, result } };
  } catch (err) {
    logger.error(err.message);
    return { hasError: true, error: err.message };
  }
};

export const propertyManagerAssetSummary = async (user, propertyId) => {
  try {
    logger.info('Inside property manager asset summary');
    let data = await propertyModel
      .aggregate([
        {
          $match: {
            _id: ObjectId(propertyId),
          },
        },
        {
          $lookup: {
            from: 'property-balance',
            foreignField: '_property',
            localField: '_id',
            as: 'balanceData',
          },
        },
        {
          $project: {
            assetValue: '$financials.assetValue',
            maintenanceReserve: '$financials.maintenanceReserve',
            vacancyReserve: '$financials.vacancyReserve',
            coowners: '$balanceData',
          },
        },
      ])
      .toArray();
    [data] = data;
    data.coowners = data.coowners.length;
    return { hasError: false, value: data };
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const propertyTransactionsForPM = async (
  propertyId,
  filters,
  userId
) => {
  try {
    logger.info('Inside property transactions for Project managers service');
    const { type, startDate, endDate } = filters;
    let { page, limit, search } = filters;
    page = page ? Number(page) : 1;
    limit = limit ? Number(limit) : 10;
    let requestQuery = {
      propertyId: ObjectId(propertyId),
    };
    if (startDate && endDate) {
      requestQuery.createdAt = { $gte: dateFormats.dateToUtc(startDate) };
      requestQuery.updatedAt = { $lte: dateFormats.dateToUtc(endDate) };
    }
    let transaction = await Transaction.find(requestQuery).toArray();
    // let transfers = await transferModel.find(requestQuery).toArray();
    let transfers = await transferModel
      .aggregate([
        {
          $match: requestQuery,
        },
        {
          $match: {
            userId: userId,
          },
        },
        {
          $lookup: {
            from: 'monthlyRent',
            foreignField: '_id',
            localField: '_monthlyRent',
            as: 'monthlyRentData',
          },
        },
        {
          $unwind: {
            path: '$monthlyRentData',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            id: 1,
            amount: 1,
            transactionType: 1,
            transferType: 1,
            status: 1,
            propertyId: 1,
            admin: 1,
            merchant: 1,
            userId: 1,
            _monthlyRent: 1,
            createdAt: 1,
            updatedAt: 1,
            monthlyRentData: {
              rentAmount: '$monthlyRentData.rentAmount',
              distributableAmount: '$monthlyRentData.distributableAmount',
              maintenanceFee: '$monthlyRentData.maintenanceFee',
              vacancyFee: '$monthlyRentData.vacancyFee',
              toCoowners: '$monthlyRentData.distributableAmount',
              endDate: '$monthlyRentData.endDate',
            },
          },
        },
      ])
      .toArray();

    let result = [...transfers, ...transaction];
    result = result.map((item) => {
      if (item?.transactionType === 'rent') {
        item.source = 'Property Manager';
        item.destination = 'Property Wallet';
        item.transferType = item?.transferType;
        item.txnType = 'rent';
        return item;
      } else if (item?.transactionType === 'marketplace') {
        item.source =
          item?.transferType === 'sent' ? item?.userId : 'Property Wallet';
        item.destination =
          item?.transferType === 'sent' ? 'Property Wallet' : item?.userId;
        item.txnType = item.transactionType;
        item.transferType = item?.transferType;
        return item;
      } else {
        item.source = 'Property Wallet';
        item.destination = 'Property Manager';
        item.txnType = item?.type;
        item.transferType = 'received';
        item.status = 'completed';
        return item;
      }
    });
    if (type) {
      result = result
        .map((el) => {
          if (el.txnType == type) return el;
        })
        .filter((item) => item);
    }
    if (search) {
      search = search.replace(/[^a-zA-Z0-9. ]/gi, '');
      search = new RegExp(`${search}`, 'i');
      result = result
        .map((el) => {
          el.source = el.source.toString();

          if (el?.amount?.amount?.match(search)) return el;
          if (el?.txnType?.match(search)) return el;
          if (el?.source?.match(search)) return el;
          if (el?.destination?.match(search)) return el;
          if (el?.status?.match(search)) return el;
        })
        .filter((item) => item);
    }

    const totalCount = result.length;

    result = result
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice((page - 1) * limit, (page - 1) * limit + limit);
    const response = {
      totalCount,
      data: result,
    };
    return response;
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const getReservesTransaction = async (page, limit, property) => {
  try {
    logger.info('Inside get reserves transaction service');

    const startIndex = +page > 0 ? +page - 1 : 0;
    const perPage = +limit > 0 ? +limit : 10;

    let maintenanceReserveResult = [];
    let vacancyReserveResult = [];
    const monthlyRentTransaction = await monthlyRentModel
      .find({
        _property: property._id,
      })
      .toArray();

    monthlyRentTransaction.forEach((el) => {
      if (el?.maintenanceFee && el.maintenanceFee !== 0) {
        maintenanceReserveResult.push({
          transactionType: 'rent',
          transferType: 'received',
          amount: el.maintenanceFee,
          updatedAt: el.updatedAt,
          reserve: 'Maintenance Reserve',
          source: property.otherInfo.title,
          destination: 'Maintenance Reserve',
        });
      }

      if (el?.vacancyFee && el.vacancyFee !== 0) {
        vacancyReserveResult.push({
          transactionType: 'rent',
          transferType: 'received',
          amount: el.vacancyFee,
          updatedAt: el.updatedAt,
          reserve: 'Vacancy Reserve',
          source: property.otherInfo.title,
          destination: 'Vacancy Reserve',
        });
      }
    });

    const initiateTransactionList = await Transaction.find({
      propertyId: property._id,
    }).toArray();
    initiateTransactionList.forEach((el) => {
      if (el?.type === 'Maintenance Reserve') {
        maintenanceReserveResult.push({
          transactionType: 'transaction',
          transferType: 'sent',
          amount: el.amount,
          updatedAt: el.updatedAt,
          title: el.title,
          reserve: 'Maintenance Reserve',
          source: 'Maintenance Reserve',
          destination: 'Property Manager',
        });
      }

      if (el?.type === 'Vacancy Reserve') {
        vacancyReserveResult.push({
          transactionType: 'transaction',
          transferType: 'sent',
          amount: el.amount,
          updatedAt: el.updatedAt,
          title: el.title,
          reserve: 'Vacancy Reserve',
          source: 'Vacancy Reserve',
          destination: 'Property Manager',
        });
      }
    });
    const crowdsaleTransfer = [];
    if (
      property.crowdSale.status === 'completed' &&
      property.crowdSale.investmentReceived
    ) {
      const crowdsaleTransferTxn = await transferModel.findOne({
        propertyId: property._id,
        transactionType: 'crowdsale_success',
      });
      if (crowdsaleTransferTxn) {
        crowdsaleTransfer.push(
          {
            transactionType: 'crowdsale success',
            transferType: 'received',
            amount: property.financials?.maintenanceReserveBal,
            updatedAt: crowdsaleTransferTxn.createdAt,
            reserve: 'Maintenance Reserve',
            source: property.otherInfo.title,
            destination: 'Maintenance Reserve',
          },
          {
            transactionType: 'crowdsale success',
            transferType: 'received',
            amount: property.financials?.vacancyReserveBal,
            updatedAt: crowdsaleTransferTxn.createdAt,
            reserve: 'Vacancy Reserve',
            source: property.otherInfo.title,
            destination: 'Vacancy Reserve',
          }
        );
      }
    }
    let data = [
      ...maintenanceReserveResult,
      ...vacancyReserveResult,
      ...crowdsaleTransfer,
    ];
    data = data
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(startIndex * perPage, startIndex * perPage + perPage);
    return data;
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const getCoowners = async (propertyId) => {
  try {
    logger.info('Inside get coowners service');
    const coownersList = await balanceModel.aggregate([
      {
        $match: {
          _property: propertyId,
        },
      },
      {
        $lookup: {
          from: 'user',
          foreignField: '_id',
          localField: '_user',
          as: 'userData',
        },
      },
      {
        $lookup: {
          from: 'admin',
          foreignField: '_id',
          localField: '_user',
          as: 'adminData',
        },
      },
      {
        $unwind: {
          path: '$userData',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: '$adminData',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          tokens: 1,
          avgPrice: 1,
          name: {
            $cond: {
              if: '$userData',
              then: '$userData.firstName',
              else: '$adminData.name',
            },
          },
          email: {
            $cond: {
              if: '$userData',
              then: '$userData.email',
              else: '$adminData.email',
            },
          },
        },
      },
    ]);
    return coownersList;
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const checkForMarketAssigned = async (marketId) => {
  try {
    logger.info('Inside check for market assigned service');
    const property = await propertyModel
      .find({
        'otherInfo._market': marketId,
      })
      .toArray();
    return property;
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const deleteMarketDoc = async (marketId) => {
  try {
    logger.info('Inside delete market doc service');
    const market = await marketModel.deleteOne({ _id: marketId });
    if (market?.error) {
      return { error: market.error };
    }
    return market;
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const transferOwnership = async (user, ownershipTo) => {
  try {
    logger.info('Inside transfer ownership');
    await web3Helper.initializationPromise;
    const transfer = await web3Helper.ExecuteMethod(
      'SEND',
      web3Helper.contracts.Token,
      'transferOwnership',
      [ownershipTo]
    );
    if (transfer?.error) {
      throw new Error(mint.error);
    }
    return transfer;
  } catch (err) {
    logger.error(err);
    return;
  }
};

export const fetchCheckoutPayment = async (paymentId, admin) => {
  try {
    logger.info('Inside fetch checkout payment service');
    if (!paymentId) return { error: 'No checkout payment found' };
    let payment;
    if (admin) {
      payment = await AdminPayment.findOne({ _id: ObjectId(paymentId) });
    } else {
      payment = await Payment.findOne({ _id: ObjectId(paymentId) });
    }
    return payment;
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const checkoutPaymentFailed = async (paymentId, reason) => {
  try {
    logger.info('Inside checkout payment failed service');
    await Payment.updateOne(
      { _id: paymentId },
      { $set: { investmentStatus: 'failed', reason } }
    );
    return true;
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const actualTokensAvailable = async (propertyId) => {
  try {
    logger.info('Inside actual tokens available service');
    const tokens = await orderModel.aggregate([
      {
        $match: {
          _property: propertyId,
        },
      },
      {
        $addFields: {
          tokensAvailable: { $add: ['$tokens', '$tokensOnHold'] },
        },
      },
      {
        $group: {
          _id: '$_property',
          actualTokensAvailable: { $sum: '$tokensAvailable' },
        },
      },
    ]);
    if (tokens?.length === 0) return null;
    return tokens[0].actualTokensAvailable;
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const fetchUserFromPayment = async (paymentId) => {
  try {
    logger.info('Inside fetch user from payment service');
    const payment = await Payment.findOne(ObjectId(paymentId));
    if (payment) {
      const user = await userModel.findOne({ _id: payment._user });
      if (!user) return null;
      delete user.password;
      return user;
    }
    return null;
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const updateInvestmentStatus = async (paymentId, status, admin) => {
  try {
    logger.info('update investment status service');
    if (admin) {
      await AdminPayment.updateOne(
        { _id: paymentId },
        { $set: { investmentStatus: status } }
      );
    } else {
      await Payment.updateOne(
        { _id: paymentId },
        { $set: { investmentStatus: status } }
      );
    }
    return;
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const unholdTokensAndCredits = async (paymentId) => {
  try {
    logger.info('Inside unhold tokens and credits');
    const payment = await Payment.findOne({ _id: paymentId });
    for await (const order of payment.holdOrders) {
      await orderModel.updateOne(
        { _id: order.id },
        { $inc: { tokensOnHold: -order.hold, tokens: order.hold } }
      );
    }
    const user = await userModel.findOne({ _id: payment._user });
    let creditsOnHold = user.creditsOnHold;
    let rentCreditsOnHold = user.rentCreditsOnHold;
    let giftCreditsOnHold = user.giftCreditsOnHold;

    await userModel.updateOne(
      { _id: payment._user },
      {
        $inc: {
          credits: creditsOnHold,
          creditsOnHold: -creditsOnHold,
          rentCredits: rentCreditsOnHold,
          rentCreditsOnHold: -rentCreditsOnHold,
          giftCredits: giftCreditsOnHold,
          giftCreditsOnHold: -giftCreditsOnHold,
        },
      }
    );
    return;
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const getAllComparableProperties = async () => {
  try {
    logger.info('Inside get all comparable properties service');
    const properties = await comparablePropertyModel.find();
    const totalCount = await comparablePropertyModel.countDocuments();

    return { data: properties, totalCount };
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const getAllComparablePropertiesByPropertyId = async (propertyId) => {
  try {
    logger.info('Inside get all comparable properties by property id service');
    const properties = await comparablePropertyModel.find({
      properties: { $in: [propertyId] },
    });
    const ids = [];
    properties.forEach((ele) => {
      ids.push(...ele.properties);
    });

    const filteredIds = ids.filter((ele) => {
      return ele.toString() !== propertyId.toString();
    });
    const uniqueIds = [...new Set(filteredIds)];

    const uniqueIdsArray = Array.from(uniqueIds);

    let list = propertyModel
      .find({
        _id: { $in: uniqueIdsArray },
      })
      .sort({ 'otherInfo.isTrending': -1 });
    let totalItems = propertyModel.countDocuments({
      _id: { $in: uniqueIdsArray },
    });
    [totalItems, list] = await Promise.all([totalItems, list.toArray()]);
    const result = [];

    for (let i = 0; i < list.length; i++) {
      let tokensAvailable = await tokensAtSold(list[i]._id);
      const propertyValue =
        list[i].financials.propertyValues.length > 0
          ? list[i].financials.propertyValues[
              list[i].financials.propertyValues.length - 1
            ].value
          : 0;
      result.push({
        _id: list[i]._id,
        mainImage: list[i].images.list[list[i].images.mainImage],
        images: list[i].images,
        otherInfo: list[i].otherInfo,
        city: list[i].attom.city,
        state: list[i].attom.state,
        country: list[i].attom.country,
        description: list[i].otherInfo.descriptionHeading,
        pricePerToken:
          (propertyValue - list[i].financials.currentDebt) /
          list[i].crowdSale.numberOfTokens,
        projectedInvestmentGain: list[i].financials.projectedInvGain,
        yearlyReturn: list[i].financials.yearlyInvReturn,
        IRR: list[i].financials.yearlyInvReturn,
        marketRatings: list[i]?.marketRatings, // TODO: This property will be taken from the market document, which this property belongs to.
        tags: list[i].otherInfo.tags,
        tokensSoldPercentage: (
          ((list[i].crowdSale.numberOfTokens - tokensAvailable) /
            list[i].crowdSale.numberOfTokens) *
          100
        ).toFixed(2),
        numberOfTokens: list[i].crowdSale.numberOfTokens,
        tokensSold: list[i].crowdSale.numberOfTokens - tokensAvailable,
        title: list[i].otherInfo.title,
        trending: list[i].otherInfo.isTrending,
        updatedAt: list[i].updatedAt,
        quote: list[i].otherInfo.quote,
        latitude: list[i].attom?.latitude,
        longitude: list[i].attom?.longitude,
        startDate: list[i].crowdSale.startDate,
        stopDate: list[i].crowdSale.stopDate,
        minInvestment:
          list[i].crowdSale.minInvestment ??
          (await config.crowdSale).minInvestment,
        mogulFee: await config.mogulFee,
        processingFee: await config.processingFee,
        isSoldOut:
          list[i]._id.toString() === '639c9f78f00118ade264414e'
            ? true
            : (
                ((list[i].crowdSale.numberOfTokens - tokensAvailable) /
                  list[i].crowdSale.numberOfTokens) *
                100
              ).toFixed(2) === '100.00'
            ? true
            : false,
      });
    }

    return { data: result, totalCount: totalItems };
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const getComparablePropertyinDB = async (id) => {
  try {
    logger.info('Inside get comparable property service');
    const property = await comparablePropertyModel.findOne({ _id: id });

    return property;
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};

export const createComparablePropertyInDB = async (data) => {
  try {
    logger.info('Inside create comparable property service');
    if (!data) {
      return;
    }
    const comparableProperty = await comparablePropertyModel.create(data);
    return comparableProperty;
  } catch (error) {
    logger.error(error.message);
    return { error: error.message };
  }
};

export const updateComparablePropertyInDB = async (data, id) => {
  try {
    logger.info('Inside update comparable property service');

    if (!data) {
      return;
    }

    const comparableProperty = await comparablePropertyModel.updateOne(
      { _id: id },
      data
    );

    return comparableProperty;
  } catch (error) {
    logger.error(error.message);
    return { error: error.message };
  }
};

export const deleteComparablePropertyInDB = async (id) => {
  try {
    logger.info('Inside delete comparable property service');

    await comparablePropertyModel.deleteOne({ _id: id });
  } catch (error) {
    logger.error(error.message);
    return { error: error.message };
  }
};
