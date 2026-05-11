import mongoose from 'mongoose';
import config from '../../config/config.js';
import web3Helper from '../../helpers/web3.fireblocks.js';
import TokenInfo from './tokenInfo.model.js';
import TokenMintInputs from './tokenMintInputs.model.js';
import PropertyBalance from '../marketplace/propertyBalance.model.js';
import ListingInfo from './listingInfo.model.js';
import db from '../../connections/dbMaster.js';
const Admin = db.collection('admin');
const ObjectId = mongoose.Types.ObjectId;

export const fetchTokensInfo = async () => {
  try {
    console.info('Inside fetch tokens info script function');
    // Fetch total token Ids
    let totalTokenIds = await web3Helper.ExecuteMethod(
      'CALL',
      web3Helper.contracts.Token,
      'getTotalTokenIds',
      []
    );
    if (totalTokenIds?.error)
      throw new Error('Failed to fetch total token Ids');
    totalTokenIds = +totalTokenIds;

    // Promise function to fetch token info
    const fetchTokenInfo = async (tokenId) => {
      const token = await web3Helper.ExecuteMethod(
        'CALL',
        web3Helper.contracts.Token,
        'tokenInfo',
        [tokenId]
      );
      if (token?.error) {
        console.log('Err: ', tokenId);
        return null;
      }
      const tokenInfoData = {
        tokenId,
        minted: token.minted,
        burnState: token.burnState,
        tempBurnState: token.tempBurnState,
        burnAllowedTill: token.burnAllowedTill,
        uri: token.uri,
      };
      await TokenInfo.create(tokenInfoData);
    };

    const promise = [];
    // Fetch token info for each token Ids
    for (let i = 0; i < totalTokenIds; i++) {
      promise.push(fetchTokenInfo(i));
      if (i === 30) await Promise.allSettled(promise); // limit of 40 per 1 second
    }
    await Promise.allSettled(promise);
    console.log('Script execution completed...');
    return;
  } catch (err) {
    console.log(err);
  }
};

export const fetchMintTokenInputs = async () => {
  try {
    console.info('Inside fetch mint token inputs script function');
    let tokenHoldings = await PropertyBalance.aggregate([
      {
        $match: {},
      },
      {
        $lookup: {
          from: 'property',
          foreignField: '_id',
          localField: '_property',
          as: 'property',
        },
      },
      {
        $unwind: {
          path: '$property',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          estateId: { $toInt: '$property.otherInfo.estateId' },
        },
      },
      {
        $lookup: {
          from: 'tokenInfo',
          foreignField: 'tokenId',
          localField: 'estateId',
          as: 'tokenInfo',
        },
      },
      {
        $unwind: {
          path: '$tokenInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'user',
          foreignField: '_id',
          localField: '_user',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          tokenId: '$tokenInfo.tokenId',
          uri: '$tokenInfo.uri',
          tokens: 1,
          propOwnerAddress: '$user.blockchainAddress',
        },
      },
    ]);
    const admin = await Admin.findOne({ isSuperAdmin: true });

    const holdingDataArr = tokenHoldings.map((it) => {
      return {
        tokenId: it.tokenId,
        uri: it.uri,
        amount: it.tokens,
        propOwnerAddress: it.propOwnerAddress ?? admin.blockchainAddress,
      };
    });
    await TokenMintInputs.insertMany(holdingDataArr);
    console.log('Script execution completed...');
    return;
  } catch (err) {
    console.log(err);
  }
};

export const bridgeMintNewTokens = async () => {
  try {
    console.info('Inside bridge mint new tokens script function');
    const bridgeTokens = async (data, Ids) => {
      const minted = await web3Helper.ExecuteMethod(
        'SEND',
        web3Helper.contracts.Token,
        'bridgeMintNewPropertyToken',
        [data]
      );
      if (minted?.error) {
        console.log('Err: ', minted.error);
        return { error: minted.error };
      }
      await TokenMintInputs.updateMany(
        { _id: { $in: Ids } },
        { status: 'completed', txHash: minted.transactionHash }
      );
      return;
    };

    const tokenBalance = await TokenMintInputs.find({
      status: 'pending',
    });
    const Ids = [];
    const requestData = tokenBalance.map((it) => {
      Ids.push(it._id);
      return [it.tokenId, it.uri, it.amount, it.propOwnerAddress];
    });
    await bridgeTokens(requestData, Ids);
    console.log('Script Executed...');
    return;
  } catch (err) {
    console.log(err);
  }
};

export const setApprovalForTokens = async () => {
  try {
    console.info('Inside set approval for tokens script function');
    const setApproval = async (listing) => {
      const marketplaceAddress = (await config.contracts).Marketplace.address;
      const approval = await web3Helper.ExecuteMethod(
        'SEND',
        web3Helper.contracts.Token,
        'customSetApprovalForAll',
        [listing.seller, marketplaceAddress, true]
      );
      if (approval?.error) {
        console.log('Err: ', listing._id);
        return;
      }
      await ListingInfo.updateOne(
        { _id: listing._id },
        { approveStatus: 'completed' }
      );
      return;
    };
    for await (let listing of ListingInfo.find({
      completed: false,
    })) {
      console.log(listing._id);
      await setApproval(listing);
    }
    console.log('Script Executed...');
  } catch (err) {
    console.log(err);
  }
};

export const validatePropertyBalance = async () => {
  try {
    console.info('Inside validate property balance script function');
    const holdings = await PropertyBalance.aggregate([
      {
        $match: {},
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
        $lookup: {
          from: 'user-venly-address',
          foreignField: '_id',
          localField: '_user',
          as: 'userDetails',
        },
      },
      {
        $unwind: {
          path: '$userDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _user: 1,
          blockchainAddress: '$userDetails.blockchainAddress',
          _property: 1,
          estateId: '$propertyDetails.otherInfo.estateId',
          tokens: 1,
        },
      },
    ]);

    const notSynced = [];
    const fetchAndValidateBalance = async (holding) => {
      let balance = await web3Helper.ExecuteMethod(
        'CALL',
        web3Helper.contracts.Token,
        'balanceOf',
        [holding.blockchainAddress, holding.estateId]
      );
      if (parseInt(balance) !== holding.tokens) {
        notSynced.push(holding);
      }
      return;
    };

    let flag = 1;
    for await (let holding of holdings) {
      console.log(flag, holding._id);
      await fetchAndValidateBalance(holding);
      flag++;
    }
    console.log('Not synced', notSynced);
    console.log('Script Executed...');
  } catch (err) {
    console.log(err);
  }
};
