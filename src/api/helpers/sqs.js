import AWS from 'aws-sdk';
import config from '../config/config.js';
import logger from '../config/logger.js';

AWS.config.credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};
AWS.config.update({
  region: process.env.AWS_REGION,
});

const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

export const sendToSQS = async (message, queue) => {
  logger.info('Inside send Message SQS helper service');
  const params = {
    QueueUrl: `${await config.sqsQueueUrl}/${queue}`,
    MessageBody: message.toString(),
  };
  try {
    const status = await sqs.sendMessage(params).promise();
    return status;
  } catch (err) {
    logger.error(err.message);
    return { error: err.message };
  }
};
