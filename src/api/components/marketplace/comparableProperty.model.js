import mongoose from 'mongoose';
import db from '../../connections/dbMaster.js';

const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const comparablePropertySchema = new Schema(
  {
    baths: { type: Number, default: 0 },
    beds: { type: Number, default: 0 },
    priceSold: { type: Number, default: 0 },
    sqFt: { type: Number, default: 0 },
    dateSold: { type: Date, required: false },
    name: { type: String },
    isLease: { type: Boolean, default: false },
    monthlyRent: { type: Number, default: 0 },
    properties: [{ type: ObjectId, ref: 'property' }],
  },
  {
    collection: 'comparable-property',
    timestamps: true,
  }
);

export default db.model('comparable-property', comparablePropertySchema);
