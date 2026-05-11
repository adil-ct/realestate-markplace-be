import express from 'express';
import marketplaceRouter from './marketplace/route.js';
const router = express.Router();

router.use('/marketplace', marketplaceRouter);

export default router;
