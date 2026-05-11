import express from 'express';
import {
  propertyList,
  propertyDetails,
  putOnSale,
  invest,
  getMarket,
  createMarket,
  viewMarket,
  updateMarket,
  getPortfolioSummary,
  propertyHolding,
  getPropertyTransactions,
  getAssetSummary,
  listAssets,
  reservesTransactions,
  coowners,
  deleteMarket,
  transferContractOwnership,
  fullPropertyDetails,
  userProperties,
  propertyInvestors,
  getComparableProperties,
  createComparableProperty,
  updateComparableProperty,
  deleteComparableProperty,
  getComparableProperty,
  propertyComparables,
  delistProperty,
  executeMigrationMint,
} from './controller.js';
import { authorize } from '../../middleware/authorize.js';
import { isAdmin, isSuperAdmin } from '../../middleware/isAdmin.js';
const router = express.Router();

router.get('/property-list', propertyList);
router.get('/property-details/:id', propertyDetails);
router.get('/property-details-full/:id', fullPropertyDetails);
router.get('/property-investors/:id', propertyInvestors);
router.get('/property/:id/comparable-properties', propertyComparables);
router.post('/execute-migration-mint', executeMigrationMint);
router.use(authorize);
router.post('/transfer-ownership', transferContractOwnership);
router.get('/getPropertyTransactions/:id', getPropertyTransactions);
router.post('/invest', invest);
router.get('/list-assets', listAssets);
router.get('/user-properties', userProperties);
router.get('/portfolio-summary', getPortfolioSummary);
router.get('/asset-summary/:propertyId', getAssetSummary);
router.get('/propertyHolding/:id', propertyHolding);
router.get('/market', getMarket);
router.get('/reserves-transactions/:propertyId', reservesTransactions);
router.get('/coowners/:propertyId', coowners);
router.use(isAdmin);
router.post('/create-market', createMarket);
router.get('/view-market/:id', viewMarket);
router.patch('/update-market/:id', updateMarket);
router.delete('/delete-market/:id', deleteMarket);
router.post('/put-on-sale/:propertyId', isSuperAdmin, putOnSale);
router.get('/comparable-properties', getComparableProperties);
router.get('/comparable-properties/:id', getComparableProperty);
router.post('/create-comparable-property', createComparableProperty);
router.put('/update-comparable-property/:id', updateComparableProperty);
router.delete('/delete-comparable-property/:id', deleteComparableProperty);
router.post('/delist-property/:propertyId', isSuperAdmin, delistProperty);

export default router;
