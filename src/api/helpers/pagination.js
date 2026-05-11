import _ from 'lodash';
import logger from '../config/logger.js';

class PaginationHelper {
  async Paginate(inputs) {
    logger.info('Inside Pagination Helper.');
    try {
      const {
        q,
        Model,
        populate = null,
        startIndex = 1,
        itemsPerPage = 20,
        query = {},
        sort = { _id: 1 },
        projection = {},
        hasSchema = true,
      } = inputs;
      const skipCount = startIndex > 0 ? startIndex - 1 : 0;

      const perPage = itemsPerPage > 0 ? itemsPerPage : 20;

      // Wild card search will be handled by fuzzy-search helper
      if (q) {
        // Get wildcard search query
        const fuzzyQuery = { $text: { $search: q } };
        const fuzzyProjection = { confidence: { $meta: 'textScore' } };
        const fuzzySort = { confidence: { $meta: 'textScore' } };

        Object.assign(query, fuzzyQuery);
        Object.assign(projection, fuzzyProjection);
        Object.assign(sort, fuzzySort);
      }

      const promises = [];
      promises.push(Model.countDocuments(query));

      if (populate) {
        let promise = Model.find(query, projection)
          .skip(skipCount)
          .limit(parseInt(itemsPerPage))
          .sort(sort)
          .populate(populate);
        promise = hasSchema ? promise.lean() : promise.toArray();
        promises.push(promise);
      } else {
        let promise = Model.find(query, projection)
          .skip(skipCount)
          .limit(parseInt(itemsPerPage))
          .sort(sort);
        promise = hasSchema ? promise.lean() : promise.toArray();
        promises.push(promise);
      }

      const [totalItems, items] = await Promise.all(promises);

      return {
        totalItems,
        startIndex: skipCount + 1,
        itemsPerPage: perPage,
        items,
      };
    } catch (error) {
      logger.error(error);
    }

    // On Error Return Null
    return null;
  }
}

// All Done
export default new PaginationHelper();
