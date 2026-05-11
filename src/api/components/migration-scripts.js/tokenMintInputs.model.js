import mongoose from 'mongoose';
import db from '../../connections/dbMaster.js';

const Schema = mongoose.Schema;

const tokenMintInputsSchema = new Schema(
  {
    tokenId: Number,
    uri: String,
    amount: Number,
    propOwnerAddress: String,
    status: { type: String, default: 'pending' },
    type: String,
    txHash: String,
  },
  {
    timestamps: true,
    collection: 'tokenMintInputs',
  }
);

export default db.model('tokenMintInputs', tokenMintInputsSchema);
