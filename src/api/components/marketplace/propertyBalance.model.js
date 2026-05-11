import mongoose from 'mongoose';
import db from '../../connections/dbMaster.js';

const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const propertyBalanceSchema = new Schema(
  {
    _user: { type: ObjectId, required: true, ref: 'user' },
    _property: { type: ObjectId, required: true, ref: 'property' },
    tokens: { type: Number, required: true },
    avgPrice: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: 'property-balance',
  }
);

export default db.model('property-balance', propertyBalanceSchema);
