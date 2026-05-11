import mongoose from 'mongoose';
import db from '../../connections/dbMaster.js';

const Schema = mongoose.Schema;

const tokenInfoSchema = new Schema(
  {
    tokenId: Number,
    minted: { type: Boolean, default: false },
    burnState: { type: Boolean, default: false },
    tempBurnState: { type: Boolean, default: false },
    burnAllowedTill: { type: String },
    uri: { type: String },
  },
  {
    timestamps: true,
    collection: 'tokenInfo',
  }
);

export default db.model('tokenInfo', tokenInfoSchema);
