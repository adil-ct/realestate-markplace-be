import mongoose from 'mongoose';
import db from '../../connections/dbMaster.js';

const { Schema } = mongoose;

mongoose.Promise = Promise;

const marketSchema = new Schema(
  {
    marketName: {
      type: String,
      trim: true,
      require: true,
    },
    state: {
      type: String,
      require: true,
    },
    city: {
      type: String,
      require: true,
    },
    description: {
      type: String,
    },
    rentGrowth: {
      type: Number,
      require: true,
    },
    marketRating: {
      type: String,
      require: true,
    },
    propertyGrowth: {
      type: Number,
      require: true,
    },
    marketChart: [
      {
        year: {
          type: String,
          require: true,
        },
        rent: {
          type: String,
          require: true,
        },
        appreciation: {
          type: String,
          require: true,
        },
      },
    ],
  },
  {
    collection: 'market',
    timestamps: true,
  }
);

export default db.model('market', marketSchema);
