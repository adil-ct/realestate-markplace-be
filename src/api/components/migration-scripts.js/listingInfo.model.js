import mongoose from 'mongoose';
import db from '../../connections/dbMaster.js';

const Schema = mongoose.Schema;

const listingInfoSchema = new Schema(
  {
    seller: String,
    tokenId: Number,
    amount: Number,
    price: Number,
    tokensAvailable: Number,
    completed: Boolean,
    listingId: Number,
    mode: Number,
    fundReceiverAddress: String,
    status: String,
    approveStatus: String,
  },
  {
    timestamps: true,
    collection: 'listingInfo',
  }
);

export default db.model('listingInfo', listingInfoSchema);
