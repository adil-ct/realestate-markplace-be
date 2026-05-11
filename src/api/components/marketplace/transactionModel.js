import mongoose from 'mongoose';
import db from '../../connections/dbMaster.js';

const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const transactionSchema = new Schema(
  {
    buyerId: { type: ObjectId, required: true, ref: 'user' },
    buyerAddress: { type: String, required: true },
    sellerId: { type: ObjectId, required: true, ref: 'user' },
    sellerAddress: { type: String, required: true },
    _property: { type: ObjectId, required: true, ref: 'property' },
    tokenId: { type: String, required: true },
    amount: Number,
    type: String,
    listingId: { type: String, required: true },
    tokens: { type: Number, required: true },
    price: { type: String, required: true },
    orderId: { type: ObjectId, required: true, ref: 'property-orders' },
    admin: { type: Boolean, required: true, default: false },
    crowdsale: { type: Boolean, required: true, default: false },
    isTokenTransferred: { type: Boolean, required: false },
    status: {
      type: String,
      required: true,
      default: 'pending',
      enum: ['pending', 'completed', 'failed'],
    },
    transactionHash: { type: String },
    paymentId: { type: ObjectId },
  },
  {
    timestamps: true,
    collection: 'property-transaction',
  }
);

export default db.model('property-transaction', transactionSchema);
