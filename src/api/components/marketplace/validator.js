import Joi from 'joi';
export const marketCreateRequest = async (data) => {
  const Schema = Joi.object({
    marketName: Joi.string().required(),
    state: Joi.string().required(),
    city: Joi.string().required(),
    description: Joi.string().required(),
    rentGrowth: Joi.string().required(),
    marketRating: Joi.string().required(),
    propertyGrowth: Joi.string().required(),
    marketChart: Joi.array().items({
      year: Joi.string().required(),
      rent: Joi.string().required(),
      appreciation: Joi.string().required(),
    }),
  });

  const validate = Schema.validate(data);
  let error = false;
  let message = '';

  if (validate.error) {
    message = validate.error.details[0].message;
    message = message.replace(/"/g, '');
    error = true;
  }

  return { error, message };
};

export const comparablePropertyValidator = (data) => {
  const Schema = Joi.object({
    name: Joi.string().optional().allow(null),
    baths: Joi.number().optional().allow(null),
    beds: Joi.number().optional().allow(null),
    sqFt: Joi.number().optional().allow(null),
    monthlyRent: Joi.number().optional().allow(null),
    isLease: Joi.boolean().optional().allow(null),
    priceSold: Joi.number().optional().allow(null),
    dateSold: Joi.date().optional().allow(null),
    properties: Joi.array().items(Joi.string().hex().length(24)).optional(),
  });

  const validate = Schema.validate(data);
  let error = false;
  let message = '';

  if (validate.error) {
    message = validate.error.details[0].message;
    message = message.replace(/"/g, '');
    error = true;
  }

  return { error, message };
};

export const propertyListValidator = (data) => {
  const mainSchema = {
    startIndex: Joi.number().required().greater(0),
    itemsPerPage: Joi.number().required().greater(0),
    search:Joi.string().allow('').optional()
  };
  const Schema = Joi.object(mainSchema).required();

  const validation = Schema.validate(data);
  let hasError = false;
  let error = '';

  if (validation.error) {
    error = validation.error.details[0].message;
    error = error.replace(/"/g, '');
    hasError = true;
  }

  return { error, hasError, sanitizedData: validation.value };
};
