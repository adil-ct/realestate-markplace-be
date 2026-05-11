import config from '../../config/config.js';
import web3Helper from '../../helpers/web3.fireblocks.js';
import ListingInfo from './listingInfo.model.js';
import TokenInfo from './tokenInfo.model.js';
import TokenMintInputs from './tokenMintInputs.model.js';

export const fetchListingData = async () => {
  try {
    console.info('Inside fetch listing Data script function');
    // Fetch total listing Ids
    let totalListingIds = await web3Helper.ExecuteMethod(
      'CALL',
      web3Helper.contracts.Marketplace,
      'getTotalIds',
      []
    );
    if (totalListingIds?.error)
      throw new Error('Failed to fetch total token Ids');
    totalListingIds = +totalListingIds;

    // Promise function to fetch listing info
    const fetchListingInfo = async (listingId) => {
      let listing = await web3Helper.ExecuteMethod(
        'CALL',
        web3Helper.contracts.Marketplace,
        'viewPropertyById',
        [listingId]
      );
      if (listing?.error) {
        console.log('Err: ', listingId);
        return null;
      }
      const listingInfoData = {
        seller: listing[0],
        tokenId: listing[1],
        amount: listing[2],
        price: listing[3],
        tokensAvailable: listing[4],
        completed: listing[5],
        listingId: listing[6],
        mode: listing[7],
        fundReceiverAddress: listing[8],
      };
      await ListingInfo.create(listingInfoData);
    };

    const promise = [];
    // Fetch token info for each token Ids
    for (let i = 1; i <= totalListingIds; i++) {
      promise.push(fetchListingInfo(i));
      if (i === 30) await Promise.allSettled(promise); // limit of 40 per 1 second
    }
    await Promise.allSettled(promise);
    console.log('Script execution completed...');
    return;
  } catch (err) {
    console.log(err);
  }
};

export const bridgeListingIds = async () => {
  try {
    console.info('Inside Bridge listing Ids script function');

    const bridgeListing = async (data, Ids) => {
      const listing = await web3Helper.ExecuteMethod(
        'SEND',
        web3Helper.contracts.Marketplace,
        'bridgeListProperty',
        [data]
      );
      if (listing?.error) {
        console.log('Err: ', data._id);
        return { error: listing.error };
      }
      await ListingInfo.updateMany(
        { _id: { $in: Ids } },
        { status: 'completed' }
      );
      return;
    };

    const listingData = await ListingInfo.find({
      status: 'pending',
    });
    const Ids = [];
    const requestData = listingData.map((it) => {
      Ids.push(it._id);
      return [
        it.seller,
        it.tokenId,
        it.amount,
        BigInt(it.price),
        it.tokensAvailable,
        it.completed,
        it.listingId,
        it.mode,
        it.fundReceiverAddress,
      ];
    });
    await bridgeListing(requestData, Ids);
    console.log('Script Executed...');
    return;
  } catch (err) {
    console.log(err);
  }
};

export const addListingToMintTokens = async () => {
  try {
    console.info('Inside add listing to mint tokens script function');
    for await (let listing of ListingInfo.find({ completed: false })) {
      const tokenInfo = await TokenInfo.findOne({ tokenId: listing.tokenId });
      if (!tokenInfo) continue;
      const mintData = {
        tokenId: listing.tokenId,
        uri: tokenInfo.uri,
        amount: listing.tokensAvailable,
        propOwnerAddress: (await config.contracts).Marketplace.address,
        type: 'Listing',
      };
      await TokenMintInputs.create(mintData);
    }
    console.log('Script Executed...');
  } catch (err) {
    console.log(err);
  }
};
