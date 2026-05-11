import express from 'express';
import cookieParser from 'cookie-parser';
import apiLog from 'morgan';
import cors from 'cors'
import { Consumer } from 'sqs-consumer';
import indexRouter from './components/indexRoute.js';
import config from './config/config.js';
import logger from './config/logger.js';
const app = express();

app.use(apiLog('dev'));
app.use(express.json());
app.use(cors())
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/api/v2', indexRouter);

// error handler
app.use((err, req, res, next) => {
  logger.info('Inside Error handling');
  res.status(err.status).send({
    error: {
      status: err.status || 500,
      msg: err.message || 'Internal Server Error',
      data: err.stack,
    },
  });
});

export default app;
